import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard, FEATURE_DISABLED_ERROR } from './feature-flag.guard';
import { FeatureFlagsService } from '../feature-flags.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    featureFlags = { isEnabled: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        Reflector,
        { provide: FeatureFlagsService, useValue: featureFlags },
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
    mockContextWith({ user: { id: 'user-1' } });

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

  // ⚠️ HAI TEST DƯỚI ĐÂY KHẲNG ĐỊNH LỐI TẮT LÀ ĐÚNG — và đó là lý do lỗi sống
  // sót. Ý định (chặn người CHƯA đăng nhập dò cờ qua 404-vs-401) hợp lý, nên
  // test xanh và không ai nghi ngờ. Nhưng chúng mô tả một điều kiện mà trong
  // ứng dụng thật xảy ra với MỌI request: `FeatureFlagGuard` là `APP_GUARD`
  // toàn cục nên chạy trước `JwtAuthGuard` cấp controller ⇒ `request.user` luôn
  // `undefined` ⇒ lối tắt luôn được dùng ⇒ cờ không bao giờ chặn được gì.
  // Đo trên máy chủ thật: 8/8 vòng tắt cờ mà API vẫn trả 200.
  // Xem describe cuối file, và mục Đợt 3 trong `UAT-COVERAGE.md`.
  it('skips the flag check when request.user is null (anonymous)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);
    // No user on the request — should NOT 404, pass through so the
    // downstream JwtAuthGuard can 401 uniformly. Otherwise anon callers
    // can probe enabled vs disabled features by response code.
    const ctx = mockContextWith({ user: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it('skips the flag check when request.user is missing entirely', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
    featureFlags.isEnabled.mockResolvedValue(false);
    const ctx = mockContextWith({});
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
  it.failing(
    'chặn request khi cờ tắt, kể cả khi request.user chưa được gán',
    async () => {
      const ctx = mockContextWith({ headers: { authorization: 'Bearer x' } });

      await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    },
  );

  it('vẫn chặn đúng khi request.user ĐÃ được gán (đường đi hiện hoạt động)', async () => {
    // Nửa còn lại của bằng chứng: logic kiểm cờ tự nó đúng. Hỏng nằm ở chỗ
    // trong ứng dụng thật nó không bao giờ chạy tới đây.
    const ctx = mockContextWith({
      headers: { authorization: 'Bearer x' },
      user: { id: 'u-1' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  const mockContextWith = (req: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;
});
