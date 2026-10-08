import { firstValueFrom, of } from 'rxjs';
import { CaseGraphPolicyInterceptor } from './case-graph.interceptor';
describe('CG14 source JSON graph HTTP boundary', () => {
  it('threads the authenticated actor into every response graph policy', async () => {
    const access = { redactCaseLinks: jest.fn(async () => ({ data: { id: 'source' } })) };
    const interceptor = new CaseGraphPolicyInterceptor(access as never);
    const original = { data: { id: 'source',linkedCaseId: 'private-case' } };
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { id: 'actual-actor' } }) }) };
    await expect(firstValueFrom(interceptor.intercept(context as never,{ handle: () => of(original) }))).resolves.toEqual({ data: { id: 'source' } });
    expect(access.redactCaseLinks).toHaveBeenCalledWith(original,'actual-actor');
  });
});
