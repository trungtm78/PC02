import 'reflect-metadata';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { DataScope } from '../auth/services/unit-scope.service';
import { WARD_ERROR } from './ward-assignment.codes';
import { WardAssignmentsController, WardInvestigatorsController } from './ward-assignments.controller';

type Rule = { action: string; subject: string };
const permissionsOf = (cls: object, method: string): { all?: Rule[]; any?: Rule[] } => {
  const handler = (cls as { prototype: Record<string, unknown> }).prototype[method] as object;
  return { all: Reflect.getMetadata(PERMISSIONS_KEY, handler) as Rule[] | undefined, any: Reflect.getMetadata(ANY_PERMISSIONS_KEY, handler) as Rule[] | undefined };
};
const pair = (r: Rule) => `${r.action}:${r.subject}`;

/**
 * The routes of ward assignment requests: each asks for the permission of its action (the owner's decisions: the ward
 * unit writes, edits, deletes its requests; PC02 reviews, archives, restores; the investigators are kept by either),
 * and each hands the service the scope the request carries, refusing a request that carries none.
 */
describe('the routes of ward assignment requests', () => {
  it.each([
    ['list', 'read:WardAssignment'],
    ['get', 'read:WardAssignment'],
    ['create', 'write:WardAssignment'],
    ['update', 'edit:WardAssignment'],
    ['submit', 'edit:WardAssignment'],
    ['withdraw', 'edit:WardAssignment'],
    ['remove', 'delete:WardAssignment'],
    ['archive', 'review:WardAssignment'],
    ['restore', 'review:WardAssignment'],
    ['returnReasons', 'read:WardAssignment'],
    ['followUpChoices', 'review:WardAssignment'],
    ['unitChoices', 'write:WardAssignment'],
    ['listStats', 'read:WardAssignment'],
    ['exportList', 'read:WardAssignment'],
    ['returnIt', 'review:WardAssignment'],
    ['revokeReturn', 'review:WardAssignment'],
    ['approve', 'review:WardAssignment'],
    ['cancelApproval', 'review:WardAssignment'],
    ['followUp', 'review:WardAssignment'],
    ['extend', 'review:WardAssignment'],
    ['complete', 'review:WardAssignment'],
    ['reopen', 'review:WardAssignment'],
    ['deletionImpact', 'delete:WardAssignment'],
    ['deleteWithData', 'delete:WardAssignment'],
  ])('%s asks for %s', (method, wanted) => {
    expect((permissionsOf(WardAssignmentsController, method).all ?? []).map(pair)).toEqual([wanted]);
  });

  it.each(['create', 'update', 'deactivate', 'reactivate'])('investigators: %s is allowed to whoever edits the requests or reviews them', (method) => {
    expect((permissionsOf(WardInvestigatorsController, method).any ?? []).map(pair).sort()).toEqual(['edit:WardAssignment', 'review:WardAssignment']);
  });

  it('investigators: the list asks for reading', () => {
    expect((permissionsOf(WardInvestigatorsController, 'list').all ?? []).map(pair)).toEqual(['read:WardAssignment']);
  });

  const stamp = { expectedUpdatedAt: '2026-11-16T10:00:00.000Z' };
  const user = { id: 'u-1' };
  const scope = { teamIds: [], userIds: ['u-1'], writableTeamIds: [], writableUserIds: ['u-1'] } as DataScope;
  const withScope = (s: DataScope | null | undefined) => ({ dataScope: s }) as ScopedRequest;

  function build() {
    const commands = { create: jest.fn(), update: jest.fn(), submit: jest.fn(), withdraw: jest.fn(), remove: jest.fn(), archive: jest.fn(), restore: jest.fn() };
    const queries = { list: jest.fn(), get: jest.fn(), unitChoices: jest.fn(), listStats: jest.fn(), exportList: jest.fn() };
    const investigators = { list: jest.fn(), create: jest.fn(), update: jest.fn(), setActive: jest.fn() };
    const review = {
      returnReasons: jest.fn(), returnIt: jest.fn(), revokeReturn: jest.fn(), approve: jest.fn(), cancelApproval: jest.fn(), followUp: jest.fn(),
      extend: jest.fn(), complete: jest.fn(), reopen: jest.fn(), deletionImpact: jest.fn(), deleteWithData: jest.fn(),
    };
    return {
      review,
      requests: new WardAssignmentsController(commands as never, queries as never, review as never),
      names: new WardInvestigatorsController(investigators as never),
      commands,
      queries,
      investigators,
    };
  }

  it('every route hands the service the scope of the request and the person acting', () => {
    const { requests, names, commands, queries, investigators } = build();
    const req = withScope(scope);
    requests.list({}, user, req);
    requests.unitChoices(req);
    requests.listStats({ q: 'x' }, req);
    void requests.exportList({ cot: 'code' }, user, { ...req, headers: {} } as ScopedRequest, {} as never);
    expect(queries.listStats).toHaveBeenCalledWith(scope, { q: 'x' });
    expect(queries.exportList).toHaveBeenCalledWith(scope, { cot: 'code' }, expect.anything(), { userId: 'u-1', ipAddress: undefined, userAgent: undefined });
    requests.get('a', user, req);
    requests.create({} as never, user, req);
    requests.update('a', stamp as never, user, req);
    requests.submit('a', stamp, user, req);
    requests.withdraw('a', stamp, user, req);
    requests.remove('a', stamp, user, req);
    requests.archive('a', stamp, user, req);
    requests.restore('a', stamp, user, req);
    names.list({ teamId: 't' }, req);
    names.create({ teamId: 't', fullName: 'x' }, user, req);
    names.update('i', stamp, user, req);
    names.deactivate('i', stamp, user, req);
    names.reactivate('i', stamp, user, req);
    // The list is told who reads it: the buttons of a row follow the person (PC02 does not decide its own unit's).
    expect(queries.list).toHaveBeenCalledWith(scope, {}, expect.any(Date), 'u-1');
    expect(queries.unitChoices).toHaveBeenCalledWith(scope);
    expect(queries.get).toHaveBeenCalledWith(scope, 'u-1', 'a');
    for (const m of ['submit', 'withdraw', 'remove', 'archive', 'restore'] as const) expect(commands[m]).toHaveBeenCalledWith(user, scope, 'a', stamp.expectedUpdatedAt);
    expect(commands.create).toHaveBeenCalledWith(user, scope, {});
    expect(commands.update).toHaveBeenCalledWith(user, scope, 'a', stamp);
    expect(investigators.list).toHaveBeenCalledWith(scope, 't', false);
    expect(investigators.setActive.mock.calls).toEqual([
      [user, scope, 'i', false, stamp.expectedUpdatedAt],
      [user, scope, 'i', true, stamp.expectedUpdatedAt],
    ]);
  });

  it('the review routes hand the service the scope, the person and the body as received', () => {
    const { requests, review } = build();
    const req = withScope(scope);
    const body = { expectedUpdatedAt: stamp.expectedUpdatedAt, reason: 'r' };
    requests.returnIt('a', { ...body, requirements: [] }, user, req);
    requests.revokeReturn('a', body, user, req);
    requests.approve('a', { expectedUpdatedAt: stamp.expectedUpdatedAt, assignedInvestigatorId: 'i' }, user, req);
    requests.cancelApproval('a', body, user, req);
    requests.followUp('a', { expectedUpdatedAt: stamp.expectedUpdatedAt }, user, req);
    requests.extend('a', { ...body, newDueOn: '2027-01-01' }, user, req);
    requests.complete('a', { expectedUpdatedAt: stamp.expectedUpdatedAt, completedOn: '2026-11-16' }, user, req);
    requests.reopen('a', body, user, req);
    requests.deletionImpact('a', req);
    requests.deleteWithData('a', { expectedUpdatedAt: stamp.expectedUpdatedAt, confirmCode: 'c' }, user, req);
    for (const m of ['returnIt', 'revokeReturn', 'approve', 'cancelApproval', 'followUp', 'extend', 'complete', 'reopen', 'deleteWithData'] as const) {
      expect(review[m]).toHaveBeenCalledWith(user, scope, 'a', expect.any(Object));
    }
    expect(review.deletionImpact).toHaveBeenCalledWith(scope, 'a');
    requests.returnReasons();
    expect(review.returnReasons).toHaveBeenCalled();
  });

  it('an administrator\'s scope (null) is passed on as it is', () => {
    const { requests, queries } = build();
    requests.list({}, user, withScope(null));
    expect(queries.list).toHaveBeenCalledWith(null, {}, expect.any(Date), 'u-1');
  });

  it('a request that carries no resolved scope is refused before any service is asked', () => {
    const { requests, names, commands, queries, investigators } = build();
    const req = withScope(undefined);
    const refused = { response: { code: WARD_ERROR.FORBIDDEN, details: [] } };
    expect(() => requests.list({}, user, req)).toThrow(expect.objectContaining(refused) as Error);
    expect(() => requests.unitChoices(req)).toThrow(expect.objectContaining(refused) as Error);
    expect(() => requests.submit('a', stamp, user, req)).toThrow(expect.objectContaining(refused) as Error);
    expect(() => names.list({ teamId: 't' }, req)).toThrow(expect.objectContaining(refused) as Error);
    expect(queries.list).not.toHaveBeenCalled();
    expect(commands.submit).not.toHaveBeenCalled();
    expect(investigators.list).not.toHaveBeenCalled();
  });
});
