import { LegalWorkflowService } from './legal-workflow.service';
describe('CG08 split identity, privacy and explicit existing source links', () => {
  function fixture() {
    const user = {
      id: 'actor',
      isActive: true,
      role: {
        name: 'OPERATOR',
        permissions: [
          {
            permission: {
              subject: 'Incident',
              action: 'read',
              conditions: null,
            },
          },
          {
            permission: {
              subject: 'Incident',
              action: 'edit',
              conditions: null,
            },
          },
          {
            permission: {
              subject: 'Petition',
              action: 'read',
              conditions: null,
            },
          },
          {
            permission: {
              subject: 'Petition',
              action: 'edit',
              conditions: null,
            },
          },
        ],
      },
    };
    const tx = {
      team: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team', isActive: true }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findUniqueOrThrow: jest.fn().mockResolvedValue(user),
      },
      case: {
        create: jest.fn().mockResolvedValue({ id: 'child' }),
        update: jest.fn(),
      },
      caseRelation: { create: jest.fn().mockResolvedValue({ id: 'relation' }) },
      documentNumberLog: { update: jest.fn() },
      incident: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'inc',
            updatedAt: new Date('2026-10-01'),
            assignedTeamId: 'team',
            createdById: 'actor',
            linkedCaseId: null,
          }),
        create: jest.fn(),
        update: jest.fn(),
      },
      petition: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'pet',
            updatedAt: new Date('2026-10-01'),
            assignedTeamId: 'team',
            createdById: 'actor',
            linkedCaseId: null,
          }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const core = {
        currentScope: jest
          .fn()
          .mockResolvedValue({
            writableTeamIds: ['team'],
            writableUserIds: ['actor'],
          }),
      },
      numbers = {
        commitWithTx: jest
          .fn()
          .mockResolvedValue({ number: '2026-99', logId: 'log' }),
      };
    return {
      service: new LegalWorkflowService(
        {} as never,
        core as never,
        numbers as never,
      ),
      tx,
      core,
      numbers,
    };
  }
  const source = {
    id: 'source',
    sensitivity: 'NORMAL',
    caseType: 'UY_THAC_DIEU_TRA',
    fieldDefinitionVersionId: 'pinned',
    metadata: { sensitivity: 'RESTRICTED' },
  };
  const payload = {
    newCase: {
      name: 'Allocated child',
      assignedTeamId: 'team',
      allocationBasis: 'Reviewed split',
      soQuyetDinhUyThac: 'SYNTHETIC-NEW-COMMISSION',
      donViGiao: 'Synthetic delegating unit',
      thoiHanUyThac: '2026-12-01',
      loaiUyThac: 'UY_THAC_DIEU_TRA',
      uyThacSourceDocumentId: 'doc',
    },
  };
  it('split preserves tightened legacy sensitivity, Case/UTDT type and pinned field policy without moving children or creating Incidents', async () => {
    const { service, tx, numbers } = fixture();
    await (service as any).split(tx, source, payload, 'decision', {
      actorId: 'actor',
    });
    expect(numbers.commitWithTx).toHaveBeenCalledWith(
      'CASE',
      { userId: 'actor' },
      tx,
    );
    expect(tx.case.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseCode: '2026-99',
          caseType: 'UY_THAC_DIEU_TRA',
          sensitivity: 'RESTRICTED',
          fieldDefinitionVersionId: 'pinned',
          metadata: {
            _splitProvenance: {
              sourceCaseId: 'source',
              decisionId: 'decision',
              allocationBasis: 'Reviewed split',
            },
          },
        }),
      }),
    );
    expect(tx.incident.create).not.toHaveBeenCalled();
    expect(tx.petition.create).not.toHaveBeenCalled();
    expect(tx.caseRelation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceCaseId: 'source',
          targetCaseId: 'child',
          type: 'SPLIT',
          decisionId: 'decision',
        }),
      }),
    );
  });
  it('split rejects inactive destinations, extra client IDs and outside writable allocation scope before counter mutation', async () => {
    for (const variant of ['inactive', 'scope', 'extra']) {
      const { service, tx, core, numbers } = fixture();
      if (variant === 'inactive')
        tx.team.findFirst.mockResolvedValue(null as never);
      if (variant === 'scope')
        core.currentScope.mockResolvedValue({
          writableTeamIds: [],
          writableUserIds: [],
        });
      const p =
        variant === 'extra'
          ? { newCase: { ...payload.newCase, id: 'forged' } }
          : payload;
      await expect(
        (service as any).split(tx, source, p, 'decision', { actorId: 'actor' }),
      ).rejects.toThrow();
      expect(numbers.commitWithTx).not.toHaveBeenCalled();
    }
  });
  it.each(['INCIDENT', 'PETITION'])(
    'links existing %s bidirectionally with actual source version and no phantom source creation',
    async (type) => {
      const { service, tx } = fixture(),
        id = type === 'INCIDENT' ? 'inc' : 'pet';
      await (service as any).linkSource(
        tx,
        { id: 'source', linkedIncidentId: null, linkedPetitionId: null },
        { sourceType: type, sourceId: id, sourceUpdatedAt: '2026-10-01' },
        { actorId: 'actor' },
      );
      expect(tx.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining(
            type === 'INCIDENT'
              ? { linkedIncidentId: 'inc', caseProvenance: 'FROM_INCIDENT' }
              : { linkedPetitionId: 'pet', caseProvenance: 'FROM_PETITION' },
          ),
        }),
      );
      expect(tx.incident.create).not.toHaveBeenCalled();
      expect(tx.petition.create).not.toHaveBeenCalled();
    },
  );
  it.each(['INCIDENT', 'PETITION'])(
    'cannot relink existing %s source or silently invent missing provenance',
    async (type) => {
      const { service, tx } = fixture();
      await expect(
        (service as any).linkSource(
          tx,
          {
            id: 'source',
            linkedIncidentId: 'existing',
            linkedPetitionId: 'existing',
          },
          {
            sourceType: type,
            sourceId: 'other',
            sourceUpdatedAt: '2026-10-01',
          },
          { actorId: 'actor' },
        ),
      ).rejects.toThrow();
      expect(tx.case.update).not.toHaveBeenCalled();
    },
  );
});
