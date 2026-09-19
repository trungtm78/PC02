import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from './feature-flag.guard';
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

  // 19/09/2026: guard này chạy SAU JwtAuthGuard (khai trong @UseGuards của controller). Tới đây mà không có user
  // nghĩa là bị đặt sai chỗ (trước JWT, hoặc toàn cục) — 401 đồng nhất với JwtAuthGuard, KHÔNG cho qua. Bản cũ
  // đăng ký APP_GUARD: guard toàn cục chạy TRƯỚC JWT nên user luôn rỗng → luôn cho qua → tắt tính năng không chặn API.
  it.each([[{ user: null }], [{}]])(
    'không có user → 401, không kiểm cờ, không cho qua (%j)',
    async (req) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('cases');
      featureFlags.isEnabled.mockResolvedValue(true);
      await expect(
        guard.canActivate(mockContextWith(req)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
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
