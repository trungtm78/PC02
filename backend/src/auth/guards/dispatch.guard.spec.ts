import { ExecutionContext } from '@nestjs/common';
import { DispatchGuard } from './dispatch.guard';

function makeCtx(user: Record<string, unknown> | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('DispatchGuard', () => {
  let guard: DispatchGuard;

  beforeEach(() => {
    guard = new DispatchGuard();
  });

  it('allows when canDispatch=true', () => {
    expect(guard.canActivate(makeCtx({ canDispatch: true, role: 'OFFICER' }))).toBe(true);
  });

  it('denies when canDispatch=false and role is not ADMIN', () => {
    expect(guard.canActivate(makeCtx({ canDispatch: false, role: 'OFFICER' }))).toBe(false);
  });

  it('allows ADMIN regardless of canDispatch', () => {
    expect(guard.canActivate(makeCtx({ canDispatch: false, role: 'ADMIN' }))).toBe(true);
  });

  it('denies when user is undefined (unauthenticated request)', () => {
    expect(guard.canActivate(makeCtx(undefined))).toBe(false);
  });
});
