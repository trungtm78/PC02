import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard, FEATURE_DISABLED_ERROR } from './feature-flag.guard';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/** Header mang token hợp lệ — `JwtService` được mock nên nội dung không quan trọng. */
const AUTHED = { authorization: 'Bearer valid-token' };

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let featureFlags: { isEnabled: jest.Mock };
  let jwtService: { verify: jest.Mock };

  beforeEach(async () => {
    featureFlags = { isEnabled: jest.fn() };
    jwtService = { verify: jest.fn(() => ({ sub: 'u-1' })) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        Reflector,
        { provide: FeatureFlagsService, useValue: featureFlags },
        // Guard tự xác thực token (ADR-0018) nên cần hai dependency này.
        // `ConfigService` trỏ vào khoá công khai CÓ TRONG REPO để constructor
        // chạy nguyên vẹn; `JwtService` là thật, ta điều khiển kết quả bằng
        // token truyền vào chứ không bằng mock.
        {
          provide: ConfigService,
          useValue: {
            get: (_k: string, d?: string) => d ?? './keys/public.pem',
          },
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    guard = module.get(FeatureFlagGuard);
    reflector = module.get(Reflector);
  });

  const mockContextWith = (req: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  const authedContext = (): ExecutionContext =>
    mockContextWith({ headers: AUTHED });

  it('allows routes that are not gated on a feature flag', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(authedContext())).resolves.toBe(true);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it('allows routes when their flag is enabled', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(true);
    await expect(guard.canActivate(authedContext())).resolves.toBe(true);
    expect(featureFlags.isEnabled).toHaveBeenCalledWith('cases');
  });

  it('throws NotFoundException when the flag is disabled for an authed user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);
    await expect(guard.canActivate(authedContext())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // A bare 404 is indistinguishable from "record not found", so every client
  // showed the wrong thing — the mobile app put `Lỗi: DioException ... 404`
  // in front of an officer who had done nothing wrong. The status stays 404;
  // the body is what carries the difference.
  it('carries a distinguishable error code, not a bare 404', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(authedContext())).rejects.toMatchObject({
      response: {
        statusCode: 404,
        error: FEATURE_DISABLED_ERROR,
        feature: 'cases',
      },
    });
  });

  it('names the feature in Vietnamese so the client can show it verbatim', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(authedContext())).rejects.toMatchObject({
      response: { message: expect.stringContaining('đang tắt') as string },
    });
  });

  it('falls back to the raw key when the manifest has no label', async () => {
    // A flag can exist in the database without a manifest entry — that is the
    // FE/BE mismatch this project has hit three times. It must not crash the
    // guard.
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue('khong-co-manifest');
    featureFlags.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(authedContext())).rejects.toMatchObject({
      response: {
        feature: 'khong-co-manifest',
        message: expect.stringContaining('khong-co-manifest') as string,
      },
    });
  });

  // Lối tắt cho người CHƯA đăng nhập vẫn giữ — ý định đúng: không cho dò cờ
  // nào đang bật bằng cách so 404 (tắt) với 401 (bật).
  //
  // Cái đã đổi (ADR-0018): "đã đăng nhập" nay xác định bằng TOKEN HỢP LỆ, không
  // bằng `request.user`. Guard này là `APP_GUARD` toàn cục nên chạy TRƯỚC
  // `JwtAuthGuard` cấp controller — đọc `request.user` ở đây luôn thấy
  // `undefined`, và cờ tắt không bao giờ chặn được gì (đo 8/8 lần trên máy chủ
  // thật). Hai test cũ khẳng định hành vi đó là đúng, nên lỗi sống sót qua 4400
  // test: một test xanh khẳng định chính cái làm hỏng hệ thống.
  it('bỏ qua kiểm cờ khi không có token (người chưa đăng nhập)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);

    const ctx = mockContextWith({ headers: {} });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it('bỏ qua kiểm cờ khi token hỏng — không phải chỉ khi thiếu token', async () => {
    // Nếu chỉ kiểm header CÓ MẶT thì kẻ dò gửi "Bearer x" là qua được lối tắt và
    // lỗ 404-vs-401 còn nguyên. Phải verify chữ ký thật.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const ctx = mockContextWith({ headers: { authorization: 'Bearer rác' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it('reads metadata from both handler and class', async () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(true);
    await guard.canActivate(authedContext());
    expect(spy).toHaveBeenCalledWith(FEATURE_FLAG_KEY, expect.any(Array));
    const [, targets] = spy.mock.calls[0];
    expect(Array.isArray(targets) && targets.length).toBe(2);
  });
});

/**
 * Chỗ trống mà 4400 test không bao giờ chạm tới.
 *
 * `feature-gating.spec.ts` kiểm *manifest ⇔ decorator khớp nhau* — tức decorator
 * có được GẮN không. Không test nào kiểm cờ tắt thì request có bị CHẶN không.
 * Từng mảnh đúng, chỗ nối sai, và không ai thấy.
 *
 * Đo trên máy chủ đang chạy: 8/8 vòng tắt cờ `lawyers` rồi gọi `GET /lawyers`
 * đều trả 200. Vì sao: `FeatureFlagGuard` đăng ký `APP_GUARD` toàn cục nên chạy
 * TRƯỚC `JwtAuthGuard` cấp controller, nên `request.user` LUÔN `undefined` trong
 * ứng dụng thật — đúng điều kiện mà `if (!request.user) return true` cho qua.
 */
describe('FeatureFlagGuard — cờ tắt phải CHẶN được (điều kiện của ứng dụng thật)', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    featureFlags = { isEnabled: jest.fn(() => Promise.resolve(false)) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        Reflector,
        { provide: FeatureFlagsService, useValue: featureFlags },
        {
          provide: ConfigService,
          useValue: {
            get: (_k: string, d?: string) => d ?? './keys/public.pem',
          },
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn(() => ({ sub: 'u-1' })) },
        },
      ],
    }).compile();
    guard = module.get(FeatureFlagGuard);
    reflector = module.get(Reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('lawyers');
  });

  // `it.failing` = "test này ĐANG phải đỏ". CI xanh chừng nào lỗi còn đó, và
  // ĐỎ ngay khi ai đó sửa xong — buộc người sửa quay lại bỏ `.failing` và biến
  // nó thành test hồi quy thật. Đó là bước cuối của bản vá, không phải việc riêng.
  //
  // Dùng `it.failing` (theo TỪNG test) chứ không phải cơ chế theo describe: đặt
  // ở phạm vi describe thì nó áp cho mọi test trong khối, và một test vốn xanh
  // sẽ báo "expected to fail but passed" — tôi đã mắc đúng bẫy đó với
  // `test.fail()` bên Playwright và suýt rút lại một kết luận đúng.
  it('chặn request khi cờ tắt dù request.user chưa được gán', async () => {
    const ctx = mockContextWith({ headers: AUTHED });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('vẫn chặn đúng khi request.user ĐÃ được gán (đường đi hiện hoạt động)', async () => {
    // Nửa còn lại của bằng chứng: logic kiểm cờ tự nó đúng. Hỏng nằm ở chỗ
    // trong ứng dụng thật nó không bao giờ chạy tới đây.
    const ctx = mockContextWith({ headers: AUTHED, user: { id: 'u-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  const mockContextWith = (req: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;
});
