/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import type { DataScope } from '../auth/services/unit-scope.service';
import { NotFoundException } from '@nestjs/common';
import type { CaseSourceCreationService } from './case-source-creation.service';
const scopes = new WeakMap<object, DataScope | null>();
export function setSourceFixtureScope(db: object, scope: DataScope | null = null) { scopes.set(db,scope); }
/** Legacy source-domain unit suites retain their original oracles; actual creation authorization has real-provider suites. */
export function ordinarySourceFixture(db: any): CaseSourceCreationService {
  return {
    execute: jest.fn(async (input: any, _actorId: string, handler: any) => {
      const source = await db[input.kind === 'Incident' ? 'incident' : 'petition'].findFirst({ where: { id: input.sourceId, deletedAt: null } });
      if (!source) {
        throw new NotFoundException('Source not found');
      }
      const record = await db.$transaction((tx: any) => handler(tx,source,{ enabled: false, scope: scopes.get(db) ?? null, prepare: async (data: unknown) => data }));
      return { caseRecord: record, replayed: false };
    }),
  } as unknown as CaseSourceCreationService;
}
