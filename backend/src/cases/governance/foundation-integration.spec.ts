/* In-memory Prisma delegate fixtures intentionally use partial dynamic records. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { CasesService } from '../cases.service';
import { CaseFieldSchemaService } from './case-field-schema.service';
import { kiemVuAnChaDeGhi } from '../../common/utils/kiem-vu-an-cha';
import { assertParentInScope } from '../../common/utils/scope-filter.util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Case foundation integration regressions', () => {
  it('feature-on same-team assignment is ledgered, audited and notified once and rejects cross-team ownership changes', async () => {
    const f = fixture();
    f.record.assignedTeamId = 'team1';
    f.db.featureFlag.findUnique = async () => ({ enabled: true });
    const getActor = f.db.user.findUnique;
    f.db.user.findUnique = async () => {
      const actor = await getActor();
      actor.role.permissions.push({
        permission: {
          subject: 'CaseGovernance',
          action: 'operate',
          conditions: null,
        },
      });
      return actor;
    };
    f.db.case.updateMany = jest.fn(async () => ({ count: 1 }));
    f.db.team = { findFirst: async () => ({ id: 'team1', isActive: true }) };
    f.db.userTeam = {
      findFirst: async () => ({ userId: 'recipient', teamId: 'team1' }),
    };
    const ledger: any[] = [];
    f.db.caseGovernanceOperation = {
      findUnique: async ({ where }: any) =>
        ledger.find(
          (entry) =>
            entry.requestKey ===
            where.actorId_caseId_operation_requestKey.requestKey,
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: 'op', ...data };
        ledger.push(row);
        return row;
      },
      update: async ({ data }: any) => Object.assign(ledger.at(-1), data),
    };
    f.db.caseGovernanceEvent = { create: jest.fn() };
    f.db.auditLog = { create: jest.fn() };
    f.db.caseGovernanceOutbox = { create: jest.fn() };
    const input = {
      assignedTeamId: 'team1',
      investigatorId: 'recipient',
      requestKey: 'assign1',
      expectedUpdatedAt: f.record.updatedAt.toISOString(),
    };
    const first = await f.service.assignCase('c1', input, 'u1');
    if (!('data' in first))
      throw new Error('Governed assignment must return its committed Case');
    expect(first.data).toMatchObject({
      id: 'c1',
      assignedTeamId: 'team1',
      investigatorId: 'recipient',
    });
    expect(await f.service.assignCase('c1', input, 'u1')).toEqual(first);
    expect(f.db.case.update).toHaveBeenCalledTimes(1);
    expect(f.db.caseGovernanceEvent.create).toHaveBeenCalledTimes(1);
    expect(f.db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(f.db.caseGovernanceOutbox.create).toHaveBeenCalledTimes(1);
    expect(f.db.caseGovernanceOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: 'recipient',
          event: { type: 'CASE_ASSIGNED' },
        }),
      }),
    );
    await expect(
      f.service.assignCase(
        'c1',
        { ...input, assignedTeamId: 'foreign-team', requestKey: 'cross-team' },
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).toHaveBeenCalledTimes(1);
    expect(f.db.caseGovernanceOutbox.create).toHaveBeenCalledTimes(1);
  });
  it('configured private period belongs inside the field-policy partitions, never the outer predicate', async () => {
    const f = fixture();
    (f.service as any).settings = {
      getKyThongKe: async () => ({
        ky: 'THANG_NAY',
        truong: 'NGAY_TIEP_NHAN',
        tuNgay: '2026-10-01',
        denNgay: '2026-10-31',
      }),
    };
    f.db.caseFieldDefinitionVersion = { findMany: async () => [] };
    const factory = jest
      .spyOn(CaseFieldSchemaService.prototype, 'policyAwareSearchWhere')
      .mockResolvedValue({ id: 'authorized-summary' });
    const result = await f.service.dungWhereDanhSach({} as any, null, {
      actorId: 'u1',
    });
    expect(factory.mock.calls[0][5]).toEqual({
      field: 'ngayDeXuat',
      where: {
        ngayDeXuat: {
          gte: new Date('2026-10-01T00:00:00'),
          lte: new Date('2026-10-31T23:59:59.999'),
        },
      },
    });
    expect(result.where).not.toHaveProperty('ngayDeXuat');
    expect(JSON.stringify(result.where)).toContain('authorized-summary');
    factory.mockRestore();
  });
  it('representation list-only default ordering cannot infer a hidden proposal date', async () => {
    const f = fixture();
    (f.service as any).settings = {
      getKyThongKe: async () => ({
        ky: 'TAT_CA',
        truong: 'NGAY_TIEP_NHAN',
        tuNgay: null,
        denNgay: null,
      }),
    };
    f.db.user.findUnique = async () => ({
      id: 'u1',
      isActive: true,
      caseAccessMode: 'REPRESENTATION_ONLY',
      role: {
        name: 'ADMIN',
        permissions: [
          { permission: { subject: 'Case', action: 'read', conditions: null } },
        ],
      },
    });
    f.db.caseFieldDefinitionVersion = { findMany: async () => [] };
    f.db.case.findMany = jest.fn(async () => []);
    f.db.case.count = async () => 0;
    await f.service.getList({} as any, null, 'u1');
    expect(f.db.case.findMany.mock.calls.at(-1)[0].orderBy).toEqual({
      id: 'asc',
    });
  });
  it('exact duplicate candidates retain current visibility before name/decision matching', async () => {
    const f = fixture();
    f.db.case.findMany = jest.fn(async () => []);
    f.db.caseFieldDefinitionVersion = { findMany: async () => [] };
    jest
      .spyOn(f.service as any, 'visibilityWhere')
      .mockResolvedValue({ id: { in: ['authorized-case'] } });
    await f.service.findDuplicateCandidates(
      'Existing name',
      'REGULAR',
      undefined,
      null,
      undefined,
      'u1',
    );
    expect(JSON.stringify(f.db.case.findMany.mock.calls[0][0].where)).toContain(
      'authorized-case',
    );
  });
  function fixture() {
    const record: any = {
      id: 'c1',
      name: 'Case',
      status: 'DANG_DIEU_TRA',
      caseType: 'REGULAR',
      sensitivity: 'NORMAL',
      createdAt: new Date('2026-10-01'),
      updatedAt: new Date('2026-10-06'),
      metadata: { crime: 'stale', unknown: 'keep' },
      assignedTeamId: null,
      investigatorId: 'u1',
    };
    const db: any = {
      user: {
        findUnique: async () => ({
          id: 'u1',
          isActive: true,
          role: {
            name: 'ADMIN',
            permissions: [
              {
                permission: {
                  subject: 'Case',
                  action: 'read',
                  conditions: null,
                },
              },
              {
                permission: {
                  subject: 'Case',
                  action: 'edit',
                  conditions: null,
                },
              },
            ],
          },
        }),
      },
      caseHandoff: { findFirst: async () => null },
      case: {
        findFirst: jest.fn(async () => record),
        findUnique: jest.fn(async () => record),
        update: jest.fn(async ({ data }: any) => ({ ...record, ...data })),
      },
      caseStatusHistory: { create: jest.fn() },
      incident: { findFirst: jest.fn(async () => null) },
      $transaction: async (fn: any) => fn(db),
    };
    db.$queryRaw = jest.fn(async () => [{ id: 'c1' }]);
    db.featureFlag = { findUnique: async () => ({ enabled: false }) };
    const audit: any = {
      wrapUpdate: async ({ updateFn }: any) => updateFn(),
      log: jest.fn(),
    };
    return {
      record,
      db,
      audit,
      service: new CasesService(
        db,
        audit,
        {} as any,
        {} as any,
        { emit: jest.fn() } as any,
      ),
    };
  }
  it('explicit canonical clear removes stale metadata alias in persisted update', async () => {
    const f = fixture();
    await f.service.update('c1', { crime: null } as any, 'u1');
    const persisted = f.db.case.update.mock.calls[0][0].data;
    expect(persisted.metadata.crime).toBeUndefined();
    expect(persisted.metadata.unknown).toBe('keep');
    expect(persisted.metadata._canonicalClears.crime).toBe(true);
  });
  it('explicit null required name returns 400 before persistence while omission preserves it', async () => {
    const f = fixture();
    await expect(
      f.service.update('c1', { name: null } as any, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
    const saved = await f.service.update('c1', { crime: null } as any, 'u1');
    expect(saved.data.name).toBe('Case');
  });
  it('native field policy prevents metadata/statistic aliases, writes and query/count inference', async () => {
    const f = fixture();
    f.record.fieldDefinitionVersionId = 'native-policy';
    f.record.sdtCungCap = 'secret-phone';
    f.record.statistic = { soTienBiThietHai: 12345 };
    f.record.metadata = {
      ...f.record.metadata,
      phone: 'secret-phone',
      statistic: { soTienBiThietHai: 12345 },
      legacyRaw: { phone: 'secret-phone' },
    };
    const schema = {
      id: 'native-policy',
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [
          { key: 'sdtCungCap', sensitivity: 'RESTRICTED' },
          { key: 'statistic.soTienBiThietHai', sensitivity: 'RESTRICTED' },
        ],
      },
    };
    f.db.caseFieldDefinitionVersion = {
      findUnique: async () => schema,
      findMany: async () => [schema],
    };
    f.db.case.findMany = async () => [
      { id: 'c1', fieldDefinitionVersionId: 'native-policy' },
    ];
    f.db.caseGovernanceGrant = { findFirst: async () => null };
    const read = await f.service.getById('c1', null, 'u1');
    expect(JSON.stringify(read)).not.toContain('secret-phone');
    expect(JSON.stringify(read)).not.toContain('12345');
    await expect(
      f.service.update('c1', { sdtCungCap: 'changed' } as any, 'u1'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.update('c1', { metadata: { phone: 'changed' } } as any, 'u1'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.update(
        'c1',
        { statistic: { soTienBiThietHai: 0 } } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.getList({ sortBy: 'sdtCungCap' } as any, null, 'u1'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.getStats(
        { tk: ['sdtCungCap~secret-phone'] } as any,
        null,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.case.update).not.toHaveBeenCalled();
  });
  it('valid header policy blocks protected name suggestion and duplicate inference before grouping', async () => {
    const f = fixture();
    const schema = {
      id: 'name-policy',
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [{ key: 'name', sensitivity: 'RESTRICTED' }],
      },
    };
    f.db.caseFieldDefinitionVersion = { findMany: async () => [schema] };
    f.db.case.findMany = jest.fn(async () => [
      { id: 'c1', fieldDefinitionVersionId: 'name-policy' },
    ]);
    f.db.case.groupBy = jest.fn();
    f.db.caseGovernanceGrant = { findFirst: async () => null };
    await expect(
      f.service.findNameSuggestions('Hidden', 'REGULAR', null, 'u1'),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.case.groupBy).not.toHaveBeenCalled();
    await expect(
      f.service.findDuplicateCandidates(
        'Hidden',
        'REGULAR',
        undefined,
        null,
        undefined,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('clone binds the source version and cannot declassify a legacy-alias restricted Case through a source-only grant', async () => {
    const f = fixture();
    f.record.sensitivity = 'NORMAL';
    f.record.metadata = {
      sensitivity: 'NORMAL',
      _sensitivity: 'RESTRICTED',
    };
    f.db.caseGovernanceGrant = {
      findFirst: async () => ({ id: 'source-only' }),
    };
    f.db.caseFieldDefinitionVersion = {
      findFirst: async () => null,
      findMany: async () => [],
    };
    f.db.case.findMany = async () => [];
    f.db.case.create = jest.fn(async ({ data }: any) => ({
      id: 'new-case',
      ...data,
    }));
    f.db.documentNumberLog = { update: async () => ({}) };
    f.db.user.findUnique = async () => ({
      id: 'u1',
      isActive: true,
      role: {
        name: 'ADMIN',
        permissions: ['read', 'write', 'edit'].map((action) => ({
          permission: { subject: 'Case', action, conditions: null },
        })),
      },
    });
    const service = new CasesService(
      f.db,
      f.audit,
      {} as any,
      {
        commitWithTx: async () => ({
          number: 'new-case-code',
          logId: 'number-log',
        }),
      } as any,
      { emit: jest.fn() } as any,
    );
    const dto: any = {
      name: 'New clone',
      caseProvenance: 'DIRECT_DISCOVERY',
      cloneSourceCaseId: 'c1',
      expectedCloneSourceUpdatedAt: f.record.updatedAt.toISOString(),
      metadata: {},
    };
    await expect(service.create(dto, 'u1')).rejects.toMatchObject({
      status: 403,
    });
    expect(f.db.case.create).not.toHaveBeenCalled();
    await expect(
      service.create(
        { ...dto, expectedCloneSourceUpdatedAt: '2000-01-01T00:00:00Z' },
        'u1',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('flag-on basic information cannot change investigator ownership', async () => {
    const f = fixture();
    f.db.featureFlag.findUnique = async () => ({ enabled: true });
    await expect(
      f.service.update(
        'c1',
        {
          expectedUpdatedAt: f.record.updatedAt.toISOString(),
          investigatorId: 'foreign-user',
        } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
  });
  it('flag-off recovery retains legal transition protection after governance adoption', async () => {
    const f = fixture();
    f.record.governanceRuleVersionId = 'published-rule';
    await expect(
      f.service.update('c1', { status: 'DA_KET_LUAN' } as any, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
  });
  it('adopted legal dates and deadlines cannot be changed by basic PUT when the feature is off', async () => {
    const f = fixture();
    f.record.governanceRuleVersionId = 'published-rule';
    f.record.deadline = new Date('2026-11-01');
    f.record.ngayKhoiTo = new Date('2026-10-01');
    await expect(
      f.service.update('c1', { deadline: '2026-12-01' } as any, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.update('c1', { ngayKhoiTo: null } as any, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.update('c1', { ngayDinhChiVuAn: '2026-10-05' } as any, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
    await expect(
      f.service.update('c1', { deadline: '2026-11-01' } as any, 'u1'),
    ).resolves.toHaveProperty('success', true);
  });
  it('does not invent suspension civil date when status changes', async () => {
    const f = fixture();
    await expect(
      f.service.update(
        'c1',
        {
          status: 'TAM_DINH_CHI',
          lyDoTamDinhChiVuAn: ['CHUA_XAC_DINH_BI_CAN'],
        } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
  });
  it('requires complete real suspension date and reason even for an old imported Case', async () => {
    const f = fixture();
    f.record.createdAt = new Date('2001-01-01');
    await expect(
      f.service.update(
        'c1',
        {
          status: 'TAM_DINH_CHI',
          ngayTamDinhChi: '2026-02-31',
          lyDoTamDinhChiVuAn: ['BAT_KHA_KHANG'],
        } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.update(
        'c1',
        { status: 'TAM_DINH_CHI', ngayTamDinhChi: '2026-10-05' } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.update).not.toHaveBeenCalled();
    expect(f.db.caseStatusHistory.create).not.toHaveBeenCalled();
  });
  it('ordinary Case save validates/pins custom values within its transaction and hides restricted values on read', async () => {
    const f = fixture();
    f.record.fieldDefinitionVersionId = 'fields1';
    f.db.featureFlag.findUnique = async () => ({ enabled: true });
    f.db.user.findUnique = async () => ({
      id: 'u1',
      isActive: true,
      role: {
        name: 'ADMIN',
        permissions: ['read', 'edit']
          .map((action) => ({
            permission: { subject: 'Case', action, conditions: null },
          }))
          .concat([
            {
              permission: {
                subject: 'CaseGovernance',
                action: 'operate',
                conditions: null,
              },
            },
          ]),
      },
    });
    f.db.caseFieldDefinitionVersion = {
      findUnique: async () => ({
        id: 'fields1',
        revision: 1,
        status: 'PUBLISHED',
        definition: {
          fields: [
            {
              key: 'custom_rating',
              label: 'Rating',
              type: 'number',
              required: true,
            },
            {
              key: 'custom_secret',
              label: 'Secret',
              type: 'text',
              required: false,
              sensitivity: 'RESTRICTED',
            },
          ],
        },
      }),
    };
    f.record.metadata._customFields = {
      custom_rating: 1,
      custom_secret: 'hidden',
    };
    const saved = await f.service.update(
      'c1',
      {
        expectedUpdatedAt: f.record.updatedAt.toISOString(),
        metadata: { _customFields: { custom_rating: 0 } },
      } as any,
      'u1',
    );
    const persisted = f.db.case.update.mock.calls[0][0].data;
    expect(persisted.fieldDefinitionVersionId).toBe('fields1');
    expect(persisted.metadata._customFields).toEqual({
      custom_rating: 0,
      custom_secret: 'hidden',
    });
    expect((saved.data.metadata as any)._customFields).toEqual({
      custom_rating: 0,
    });
    await expect(
      f.service.update(
        'c1',
        {
          expectedUpdatedAt: f.record.updatedAt.toISOString(),
          metadata: { _customFields: { custom_rating: 'bad' } },
        } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.update(
        'c1',
        {
          expectedUpdatedAt: f.record.updatedAt.toISOString(),
          fieldDefinitionVersionId: 'client-forged',
        } as any,
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('writes status history and status audit within parent transaction', async () => {
    const f = fixture();
    const tx = { ...f.db, caseStatusHistory: { create: jest.fn() } };
    f.db.$transaction = async (fn: any) => fn(tx);
    await f.service.update('c1', { status: 'DA_KET_LUAN' } as any, 'u1');
    expect(tx.caseStatusHistory.create).toHaveBeenCalled();
    expect(f.db.caseStatusHistory.create).not.toHaveBeenCalled();
    expect(f.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASE_STATUS_CHANGED' }),
      tx,
    );
  });
  it('blocks pending child creation even with null scope', async () => {
    const db: any = {
      case: { findFirst: async () => ({ id: 'c1', intakeStage: 'CHO_NHAN' }) },
    };
    await expect(kiemVuAnChaDeGhi(db, 'c1', null)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('blocks pending child edits through shared parent guard', () => {
    expect(() =>
      assertParentInScope(
        {
          assignedTeamId: null,
          investigatorId: null,
          intakeStage: 'CHO_NHAN',
        } as any,
        null,
        'write',
      ),
    ).toThrow();
  });
  it('ordinary Case save never calls automatic source factory', () => {
    const source = readFileSync(join(__dirname, '../cases.service.ts'), 'utf8');
    expect(source).not.toContain('shouldAutoCreateIncident(');
  });
});
