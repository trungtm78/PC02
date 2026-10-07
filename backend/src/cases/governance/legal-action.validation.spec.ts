import { planLegalAction } from './legal-action.validation';
import { CASE_ACTION_CATALOG } from './legal-action.catalog';
const decision = {
  type: 'SYNTHETIC',
  number: '01',
  date: '2026-10-01',
  effectiveDate: '2026-10-02',
  issuer: 'Authority',
  signatory: 'Signer',
  legalBasis: 'Specific provision',
  sourceDocumentId: 'doc',
};
describe('CG04/05 all frozen legal actions', () => {
  it.each(CASE_ACTION_CATALOG)(
    '$legacyId $code positive and wrong source/phase negative',
    (a) => {
      const record = {
        status: a.source.status,
        investigationPhase: a.source.phase,
      };
      const payload = {
        decision,
        expirationEvaluation: 'EXPIRED_VERIFIED',
        destinationAgency: 'External authority',
        targetCaseId: 'target',
      };
      expect(planLegalAction(a.code, record, payload)).toMatchObject({
        status: a.target.status,
        investigationPhase: a.target.phase,
      });
      expect(() =>
        planLegalAction(a.code, { ...record, status: 'WRONG' }, payload),
      ).toThrow();
      expect(() =>
          planLegalAction(
            a.code,
            { ...record, investigationPhase: a.source.phase === null ? 'INITIAL' : null },
            payload,
          ),
        ).toThrow();
      expect(() =>
        planLegalAction(a.code, record, {
          ...payload,
          decision: { ...decision, date: '2026-10' },
        }),
      ).toThrow();
    },
  );
  it('expiration evaluation does not discontinue and discontinuation requires persisted evaluation', () => {
    expect(
      planLegalAction(
        'REVIEW_EXPIRY',
        { status: 'TAM_DINH_CHI', investigationPhase: null },
        { decision, expirationEvaluation: 'EXPIRED_VERIFIED' },
      ).status,
    ).toBe('TAM_DINH_CHI');
    expect(() =>
      planLegalAction(
        'DISCONTINUE_EXPIRED',
        { status: 'TAM_DINH_CHI', investigationPhase: null },
        { decision },
      ),
    ).toThrow();
  });
  it('verify phase only changes explicitly unknown investigation phase', () => {
    expect(
      planLegalAction(
        'VERIFY_PHASE',
        { status: 'DANG_DIEU_TRA', investigationPhase: null },
        { decision, verifiedPhase: 'INITIAL' },
      ),
    ).toMatchObject({ status: 'DANG_DIEU_TRA', investigationPhase: 'INITIAL' });
    expect(() =>
      planLegalAction(
        'VERIFY_PHASE',
        { status: 'DANG_DIEU_TRA', investigationPhase: 'INITIAL' },
        { decision, verifiedPhase: 'RESTORED' },
      ),
    ).toThrow();
  });
  it('external transfer requires real destination independently of internal handoff', () =>
    expect(() =>
      planLegalAction(
        'TRANSFER_INITIAL',
        { status: 'DANG_DIEU_TRA', investigationPhase: 'INITIAL' },
        { decision, toTeamId: 'internal' },
      ),
    ).toThrow());
});
