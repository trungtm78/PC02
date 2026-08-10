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
