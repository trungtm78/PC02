import { of } from 'rxjs';
import { DataScopeInterceptor } from './data-scope.interceptor';
import type { UnitScopeService } from '../services/unit-scope.service';

const FAKE_SCOPE = { teamIds: ['t1'], userIds: ['u1'] };

function makeCtx(user: unknown) {
  const request: Record<string, unknown> = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as any;
}

const mockHandler = { handle: () => of(null) } as any;

describe('DataScopeInterceptor', () => {
  let interceptor: DataScopeInterceptor;
  const mockUnitScope = { resolveScope: jest.fn() } as unknown as UnitScopeService;

  beforeEach(() => {
    interceptor = new DataScopeInterceptor(mockUnitScope);
    jest.clearAllMocks();
  });

  it('sets req.dataScope from resolveScope when user has id + role', async () => {
    (mockUnitScope.resolveScope as jest.Mock).mockResolvedValue(FAKE_SCOPE);
    const ctx = makeCtx({ id: 'u1', role: 'OFFICER' });
    await interceptor.intercept(ctx, mockHandler);
    expect(mockUnitScope.resolveScope).toHaveBeenCalledWith('u1', 'OFFICER');
    expect(ctx._request.dataScope).toEqual(FAKE_SCOPE);
  });

  it('sets deny-all scope when user has id but no role (JWT without role claim)', async () => {
    const ctx = makeCtx({ id: 'u1' });
    await interceptor.intercept(ctx, mockHandler);
    expect(mockUnitScope.resolveScope).not.toHaveBeenCalled();
    expect(ctx._request.dataScope).toEqual({ teamIds: [], userIds: [] });
  });

  it('does not set dataScope for unauthenticated requests (public routes)', async () => {
    const ctx = makeCtx(undefined);
    await interceptor.intercept(ctx, mockHandler);
    expect(mockUnitScope.resolveScope).not.toHaveBeenCalled();
    expect(ctx._request.dataScope).toBeUndefined();
  });

  it('passes null scope through when ADMIN resolveScope returns null', async () => {
    (mockUnitScope.resolveScope as jest.Mock).mockResolvedValue(null);
    const ctx = makeCtx({ id: 'admin-1', role: 'ADMIN' });
    await interceptor.intercept(ctx, mockHandler);
    expect(ctx._request.dataScope).toBeNull();
  });
});
