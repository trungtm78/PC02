/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
/** Ordinary service tests isolate their own behavior; boundary security has its own real-provider suites. */
import { buildScopeFilter } from '../common/utils/scope-filter.util';
const fixtures = new WeakMap<object, any>();
export function ordinaryChildFixture(db: any) {
  if (fixtures.has(db)) return fixtures.get(db);
  const fixture = {
    scope: jest.fn().mockResolvedValue(null),
    entity: jest.fn().mockResolvedValue(undefined),
    listWhere: jest.fn().mockResolvedValue({}),
    read: jest.fn().mockResolvedValue(undefined),
    serialize: jest.fn(async (_id: string, row: unknown) => row),
    policyQuery: jest.fn(async (where: unknown) => where),
    assertExport: jest.fn().mockResolvedValue(undefined),
    parents: jest.fn(async (ids: string[]) => ids.map((id) => ({
      id,
      assignedTeamId: null,
      investigatorId: null,
      intakeStage: null,
    }))),
    parent: jest.fn((parents: any[], caseId: string) => {
      const parent = parents.find((item) => item.id === caseId);
      if (!parent) throw new Error('Current Case parent changed');
      return parent;
    }),
    transaction: jest.fn(async (handler: any) => db.$transaction(handler)),
    writeInTransaction: jest.fn(async (tx: any,ids: string[],_actor: string,_subject: string,_action: string,handler: any) => handler(tx, await fixture.parents(ids))),
    sourceDeletion: jest.fn(async (_kind: string,_id: string,_actor: string,handler: any,tx?: any) => tx ? handler(tx) : db.$transaction(handler)),
    sourceMerge: jest.fn(async (_source: string,_target: string,_actor: string,handler: any) => db.$transaction(handler)),
    write: jest.fn(async (ids: string[], _actor: string, _subject: string, _action: string, fn: (tx: any, parents: any[]) => unknown) => fn(db, await fixture.parents(ids))),
  };
  fixtures.set(db, fixture);
  return fixture;
}
export function setOrdinaryCurrentScope(db: any, scope: any = null) {
  const fixture = ordinaryChildFixture(db);
  fixture.scope.mockResolvedValue(scope);
  fixture.listWhere.mockResolvedValue(buildScopeFilter(scope) ?? {});
}
