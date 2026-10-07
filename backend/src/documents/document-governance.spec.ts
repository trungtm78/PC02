import { DocumentsService } from './documents.service';
import type { DataScope } from '../auth/services/unit-scope.service';
const scope: DataScope = {
  teamIds: ['ours'],
  userIds: ['actor'],
  writableTeamIds: ['ours'],
  writableUserIds: ['actor'],
};
function fixture() {
  const record = {
    id: 'doc-1',
    caseId: 'case-1',
    incidentId: null,
    petitionId: null,
    title: 'synthetic',
    fileName: 'safe.bin',
    updatedAt: new Date('2026-10-06T00:00:00Z'),
    case: { id: 'case-1', assignedTeamId: 'ours', investigatorId: 'actor' },
  };
  const tx = {
    document: {
      findFirst: jest.fn().mockResolvedValue(record),
      update: jest.fn().mockResolvedValue(record),
    },
    case: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'hidden',
        assignedTeamId: 'theirs',
        investigatorId: 'stranger',
      }),
    },
    incident: { findFirst: jest.fn() },
    caseAssetVersion: { findUnique: jest.fn().mockResolvedValue(null) },
    caseEvidenceHold: { findFirst: jest.fn().mockResolvedValue(null) },
    caseDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    caseCustodyEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    caseDispositionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  tx.$transaction.mockImplementation(
    (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  );
  const core = {
    assertCaseWritable: jest.fn(),
    assertCaseReadable: jest.fn(),
    hasCapability: jest.fn().mockResolvedValue(true),
  };
  const evidence = {
    authorizeAsset: jest.fn(),
    verifiedAsset: jest.fn(),
    authorizeLegacyDocumentRead: jest.fn().mockResolvedValue({
      scope,
      caseVisible: true,
      fieldDefinitionVersionId: null,
    }),
    filterDocumentCase: jest.fn((record: unknown) => Promise.resolve(record)),
  };
  const service = new DocumentsService(
    tx as never,
    { log: jest.fn() } as never,
    { isValid: jest.fn().mockResolvedValue(true) } as never,
    core as never,
    evidence as never,
  );
  return { service, tx, core, evidence, record };
}
describe('CG-R03 ordinary documents cannot bypass governance', () => {
  it.each(['update', 'reparent', 'delete'])(
    'R3 typed disposition receipt blocks ordinary %s before write',
    async (operation) => {
      const { service, tx } = fixture();
      tx.caseDispositionRequest.findFirst.mockResolvedValue({
        id: 'execution',
        receiptDocumentId: 'doc-1',
      });
      const mutation =
        operation === 'delete'
          ? service.delete('doc-1', 'actor', undefined, scope)
          : service.update(
              'doc-1',
              operation === 'reparent'
                ? { caseId: null as never }
                : { title: 'rewritten receipt' },
              'actor',
              undefined,
              scope,
            );
      await expect(mutation).rejects.toMatchObject({ status: 409 });
      expect(tx.document.update).not.toHaveBeenCalled();
    },
  );
  it('preserves immutable custody receipt source before ordinary delete', async () => {
    const { service, tx } = fixture();
    tx.caseCustodyEvent.findFirst.mockResolvedValue({
      id: 'custody1',
      sourceDocumentId: 'doc-1',
    });
    await expect(
      service.delete('doc-1', 'actor', undefined, scope),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it.each([
    { code: 'P2025' },
    { code: 'P2034' },
    { code: 'P2010', meta: { code: '40001' } },
  ])(
    'maps concurrent document/parent snapshots to HTTP conflict: $code',
    async (error) => {
      const { service, tx } = fixture();
      tx.$transaction.mockRejectedValue(error);
      await expect(
        service.update(
          'doc-1',
          { title: 'safe update' },
          'actor',
          undefined,
          scope,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.document.update).not.toHaveBeenCalled();
    },
  );
  it('preserves legal decision source before ordinary delete', async () => {
    const { service, tx } = fixture();
    tx.caseDecision.findFirst.mockResolvedValue({
      id: 'decision1',
      sourceDocumentId: 'doc-1',
    });
    await expect(
      service.delete('doc-1', 'actor', undefined, scope),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it('preservation holds allow safe metadata editing while parent and bytes remain unchanged', async () => {
    const { service, tx, record } = fixture();
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'hold' });
    tx.document.update.mockResolvedValue({
      ...record,
      title: 'retained metadata',
    });
    const result = await service.update(
      'doc-1',
      { title: 'retained metadata' },
      'actor',
      undefined,
      scope,
    );
    expect(result.data.title).toBe('retained metadata');
  });
  it('rejects reparenting to a Case outside target writable scope', async () => {
    const { service, tx } = fixture();
    await expect(
      service.update('doc-1', { caseId: 'hidden' }, 'actor', undefined, scope),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it('preserves registered original identity on ordinary reparent', async () => {
    const { service, tx } = fixture();
    tx.caseAssetVersion.findUnique.mockResolvedValue({
      id: 'asset-1',
      caseId: 'case-1',
    });
    await expect(
      service.update('doc-1', { caseId: 'case-2' }, 'actor', undefined, null),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it('preserves registered original on ordinary delete', async () => {
    const { service, tx } = fixture();
    tx.caseAssetVersion.findUnique.mockResolvedValue({
      id: 'asset-1',
      caseId: 'case-1',
    });
    await expect(
      service.delete('doc-1', 'actor', undefined, scope),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it('blocks unregistered ordinary deletion under a whole-case hold', async () => {
    const { service, tx } = fixture();
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'hold' });
    await expect(
      service.delete('doc-1', 'actor', undefined, scope),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
});
