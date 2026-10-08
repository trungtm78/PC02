import { LegalWorkflowService } from './legal-workflow.service';
describe('CG04 server-returned legal readiness', () => {
  const record = {
    id: 'case',
    status: 'DANG_DIEU_TRA',
    investigationPhase: null,
    intakeStage: null,
    fieldDefinitionVersionId: null,
  };
  function fixture() {
    const db = {
      featureFlag: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      caseHandoff: { findFirst: jest.fn().mockResolvedValue(null) },
      caseRuleVersion: { findMany: jest.fn().mockResolvedValue([]) },
      caseDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const core = {
      assertCaseReadable: jest.fn().mockResolvedValue(record),
      assertCaseWritable: jest.fn().mockResolvedValue(record),
      hasCapability: jest.fn().mockResolvedValue(true),
    };
    return {
      service: new LegalWorkflowService(db as never, core as never),
      db,
      core,
    };
  }
  it('reports missing published rule and explicit phase verification rather than guessed readiness', async () => {
    const { service } = fixture();
    const result: any = await service.actionCapabilities('case', {
      actorId: 'operator',
    });
    const initial = result.data.actions.find(
      (a: any) => a.code === 'CONCLUDE_INITIAL',
    );
    expect(initial).toMatchObject({ allowed: false, ready: false });
    expect(initial.reasons).toContain('PHASE_VERIFICATION_REQUIRED');
    expect(initial.reasons).toContain('PUBLISHED_RULE_REQUIRED');
    expect(initial.requiredFields).toContain('decision.effectiveDate');
  });
  it('flag OFF and pending intake independently block initiating commands', async () => {
    const { service, db } = fixture();
    db.featureFlag.findUnique.mockResolvedValue({ enabled: false });
    db.caseHandoff.findFirst.mockResolvedValue({ id: 'pending' } as never);
    const result: any = await service.actionCapabilities('case', {
      actorId: 'operator',
    });
    expect(
      result.data.actions.every(
        (a: any) =>
          a.reasons.includes('GOVERNANCE_DISABLED') &&
          a.reasons.includes('PENDING_HANDOFF'),
      ),
    ).toBe(true);
  });
  it('technical scope never supplies missing explicit operate authority', async () => {
    const { service, core } = fixture();
    core.hasCapability.mockResolvedValue(false);
    const result: any = await service.actionCapabilities('case', {
      actorId: 'admin',
    });
    expect(
      result.data.actions.every((a: any) =>
        a.reasons.includes('OPERATE_AUTHORITY_REQUIRED'),
      ),
    ).toBe(true);
  });
});
