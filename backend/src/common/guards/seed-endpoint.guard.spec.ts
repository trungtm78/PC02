import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SeedEndpointGuard } from './seed-endpoint.guard';
import { ROLE_NAMES } from '../constants/role.constants';

/**
 * The seed endpoints populate reference data on a fresh install. They write in
 * bulk, some are slow, and `POST /settings/seed` rewrites configuration other
 * code reads. Before this guard, `POST /notifications/seed` had no permission
 * decorator at all and `POST /directories/seed` needed only `write:Directory`,
 * which ordinary roles hold.
 */
describe('SeedEndpointGuard', () => {
  const guard = new SeedEndpointGuard();
  const original = process.env.ALLOW_SEED_ENDPOINTS;

  function contextFor(user?: { role?: string }): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  afterEach(() => {
    if (original === undefined) delete process.env.ALLOW_SEED_ENDPOINTS;
    else process.env.ALLOW_SEED_ENDPOINTS = original;
  });

  it('denies when the env flag is unset — the production case', () => {
    delete process.env.ALLOW_SEED_ENDPOINTS;

    expect(() =>
      guard.canActivate(contextFor({ role: ROLE_NAMES.ADMIN })),
    ).toThrow(ForbiddenException);
  });

  it('denies an admin when the flag is any value other than "true"', () => {
    // Guards against a .env carrying ALLOW_SEED_ENDPOINTS=1 or =yes and
    // reading as enabled.
    for (const value of ['1', 'yes', 'TRUE', '']) {
      process.env.ALLOW_SEED_ENDPOINTS = value;
      expect(() =>
        guard.canActivate(contextFor({ role: ROLE_NAMES.ADMIN })),
      ).toThrow(ForbiddenException);
    }
  });

  it('denies a non-admin even where seeding is enabled', () => {
    process.env.ALLOW_SEED_ENDPOINTS = 'true';

    expect(() =>
      guard.canActivate(contextFor({ role: ROLE_NAMES.OFFICER })),
    ).toThrow(ForbiddenException);
  });

  it('denies when there is no user on the request', () => {
    process.env.ALLOW_SEED_ENDPOINTS = 'true';

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an admin when seeding is explicitly enabled', () => {
    process.env.ALLOW_SEED_ENDPOINTS = 'true';

    expect(guard.canActivate(contextFor({ role: ROLE_NAMES.ADMIN }))).toBe(
      true,
    );
  });

  it('says which switch to flip, so the message is actionable', () => {
    delete process.env.ALLOW_SEED_ENDPOINTS;

    expect(() =>
      guard.canActivate(contextFor({ role: ROLE_NAMES.ADMIN })),
    ).toThrow(/ALLOW_SEED_ENDPOINTS/);
  });
});
