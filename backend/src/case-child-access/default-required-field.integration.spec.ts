import { validateFieldDefinition } from '../cases/governance/configuration.validation';
import { CaseSourceCreationService } from './case-source-creation.service';
import { CaseFieldSchemaService } from '../cases/governance/case-field-schema.service';

describe('CG01 required default schema at explicit source creation', () => {
  it('missing required custom value prevents source Case creation before source link/counter/event writes', async () => {
    const source = { id: 'source', updatedAt: new Date(0), assignedTeamId: null, investigatorId: 'actor', linkedCaseId: null };
    const definition = { fields: [{ key: 'custom_requiredNote', label: 'Required creation fact', type: 'text', required: true, sensitivity: 'NORMAL' }] };
    expect(() => validateFieldDefinition(definition)).not.toThrow();
    const tx = {
      $queryRaw: jest.fn(async () => []), $transaction: jest.fn(),
      user: { findUnique: jest.fn(async () => ({ roleId: 'role' })) },
      incident: { findFirst: jest.fn(async () => source) },
      featureFlag: { findUnique: jest.fn(async () => ({ enabled: true })) },
      caseGovernanceOperation: { findUnique: jest.fn(async () => null), create: jest.fn(async () => ({})) },
      caseFieldDefinitionVersion: { findFirst: jest.fn(async () => ({ id: 'required-default', status: 'PUBLISHED', definition })) },
      case: { create: jest.fn(async () => ({ id: 'created-case' })) },
    };
    tx.$transaction.mockImplementation(async (handler: (db: typeof tx) => unknown) => handler(tx));
    const core = { hasEntityPermission: jest.fn(async () => true), accessProfile: jest.fn(async () => ({ caseAccessMode: 'INTERNAL' })), currentActorScope: jest.fn(async () => null), assertCaseCreation: jest.fn(async () => undefined), hasCapability: jest.fn(async () => false), serializeCaseResult: jest.fn(async (_tx: unknown,_id: string,row: unknown) => row), recordEvent: jest.fn(), enqueue: jest.fn() };
    const fields = new CaseFieldSchemaService(tx as never,core as never);
    const creation = new CaseSourceCreationService(tx as never,core as never,fields);
    await expect(creation.execute({ kind: 'Incident', sourceId: 'source', expectedUpdatedAt: source.updatedAt.toISOString(), payload: { caseName: 'Synthetic source Case' } },'actor',async (db,_source,context) => {
      const data = await context.prepare({ name: 'Synthetic source Case', caseProvenance: 'FROM_INCIDENT', linkedIncidentId: 'source' });
      return db.case.create({ data });
    })).rejects.toThrow('Required creation fact required');
    expect(tx.case.create).not.toHaveBeenCalled();
    expect(tx.caseGovernanceOperation.create).not.toHaveBeenCalled();
    expect(core.recordEvent).not.toHaveBeenCalled();
    expect(core.enqueue).not.toHaveBeenCalled();
  });
});
