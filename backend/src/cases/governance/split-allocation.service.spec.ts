import { SplitAllocationService } from './split-allocation.service';
describe('CG08 concrete version-pinned allocation selection', () => {
  function fixture() {
    const core = {
        assertCaseReadable: jest.fn().mockResolvedValue({ id: 'source' }),
        hasSensitiveAccess: jest.fn().mockResolvedValue(false),
      },
      evidence = {
        decisionSourceSnapshot: jest
          .fn()
          .mockResolvedValue({
            documentId: 'doc',
            caseId: 'source',
            ownerCaseId: 'source',
            documentUpdatedAt: '2026-10-01T00:00:00.000Z',
            sha256: 'a'.repeat(64),
            byteLength: 1,
            assetVersionId: 'asset',
            parentVersionId: null,
            parentSha256: null,
            relationId: null,
            relationRevision: null,
          }),
      };
    const tx = {
      subject: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'subject',
            caseId: 'source',
            updatedAt: new Date('2026-10-01'),
            type: 'SUSPECT',
            fullName: 'Synthetic party',
          }),
      },
      evidence: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'evidence',
            caseId: 'source',
            updatedAt: new Date('2026-10-01'),
            name: 'Synthetic physical item',
          }),
      },
      document: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'doc',
            caseId: 'source',
            updatedAt: new Date('2026-10-01'),
          }),
      },
      caseAssetVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'asset',
            caseId: 'source',
            documentId: 'doc',
            createdAt: new Date('2026-10-01'),
          }),
      },
      case: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({
            id: 'source',
            updatedAt: new Date('2026-10-01'),
            fieldDefinitionVersionId: 'schema',
            cccdCungCap: 'private',
            statistic: { soTienThuHoi: 0, updatedAt: new Date('2026-10-01') },
            metadata: {
              _customFields: { custom_flag: false },
              _canonicalClears: { ngayKhoiTo: true },
            },
          }),
      },
      caseFieldDefinitionVersion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            status: 'PUBLISHED',
            definition: {
              fields: [
                {
                  key: 'custom_flag',
                  label: 'Flag',
                  type: 'boolean',
                  required: false,
                },
              ],
              fieldPolicies: [
                { key: 'cccdCungCap', sensitivity: 'RESTRICTED' },
              ],
            },
          }),
      },
    };
    return {
      service: new SplitAllocationService(core as never, evidence as never),
      tx,
      core,
    };
  }
  const ref = (id: string) => ({ id, expectedUpdatedAt: '2026-10-01' });
  it('pins selected subjects, physical items, original/asset versions and zero/false/clear field provenance without moving records', async () => {
    const { service, tx } = fixture();
    const result = await service.snapshot(
      tx as never,
      'source',
      {
        subjects: [ref('subject')],
        evidences: [ref('evidence')],
        documents: [ref('doc')],
        assets: [ref('asset')],
        fields: ['statistic.soTienThuHoi', 'custom_flag', 'ngayKhoiTo'],
      },
      { actorId: 'actor' },
    );
    expect(result.subjects).toEqual([
      expect.objectContaining({
        id: 'subject',
        caseId: 'source',
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(result.evidences).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.assets).toHaveLength(1);
    expect(result.fields).toContainEqual(
      expect.objectContaining({ key: 'ngayKhoiTo', state: 'CLEARED' }),
    );
    expect(result.fields).toContainEqual(
      expect.objectContaining({ key: 'custom_flag', state: 'CANONICAL' }),
    );
    expect(tx.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject', caseId: 'source', deletedAt: null },
    });
  });
  it('rejects no selection, forged/duplicate references, stale or foreign ownership and protected field keys', async () => {
    for (const allocation of [
      {},
      { subjects: [] },
      { subjects: [ref('subject'), ref('subject')] },
      { subjects: [{ id: 'subject', expectedUpdatedAt: '2026-10-02' }] },
      { fields: ['cccdCungCap'] },
      { fields: ['unregistered'] },
      { fields: ['custom_flag', 'custom_flag'] },
    ]) {
      const { service, tx } = fixture();
      await expect(
        service.snapshot(tx as never, 'source', allocation, {
          actorId: 'actor',
        }),
      ).rejects.toThrow();
    }
    const { service, tx } = fixture();
    tx.subject.findFirst.mockResolvedValue(null as never);
    await expect(
      service.snapshot(
        tx as never,
        'source',
        { subjects: [ref('foreign')] },
        { actorId: 'actor' },
      ),
    ).rejects.toThrow();
  });
});
