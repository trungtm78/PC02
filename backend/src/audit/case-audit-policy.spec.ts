/* In-memory Prisma delegate fixtures intentionally use partial dynamic records. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { AuditService } from './audit.service';
import { ordinaryCaseAuthorityFixture } from '../cases/governance/case-ordinary-test.fixture';
describe('CG-AU01 Case audit privacy', () => {
  function fixture() {
    const authority = ordinaryCaseAuthorityFixture();
    const caseRecord: any = {
      id: 'c1',
      sensitivity: 'NORMAL',
      metadata: null,
      deletedAt: null,
      fieldDefinitionVersionId: 'fields1',
    };
    const row: any = {
      id: 'audit1',
      subject: 'Case',
      subjectId: 'c1',
      action: 'CASE_UPDATED',
      metadata: {
        before: { sdtCungCap: 'old-secret', name: 'old' },
        after: { sdtCungCap: 'new-secret', name: 'new' },
      },
    };
    const db: any = {
      ...authority,
      case: {
        findMany: jest.fn(async () => [caseRecord]),
        findFirst: jest.fn(async () => caseRecord),
      },
      auditLog: {
        findUnique: jest.fn(async () => row),
        findMany: jest.fn(async () => [row]),
        count: jest.fn(async () => 1),
      },
    };
    db.$queryRaw = jest.fn(async (strings: TemplateStringsArray) =>
      strings.join('').includes('case_audit_links')
        ? [{ auditId: 'audit1', caseId: 'c1' }]
        : [],
    );
    db.caseFieldDefinitionVersion.findUnique = async () => ({
      id: 'fields1',
      status: 'PUBLISHED',
      definition: {
        fields: [],
        fieldPolicies: [{ key: 'sdtCungCap', sensitivity: 'RESTRICTED' }],
      },
    });
    return { db, row, caseRecord, service: new AuditService(db) };
  }
  it('raw detail and list diff cannot expose restricted Case values', async () => {
    const f = fixture();
    const detail = await (f.service.findById as any)('audit1', 'actor-1');
    expect(JSON.stringify(detail)).not.toContain('old-secret');
    expect(JSON.stringify(detail)).not.toContain('new-secret');
    const list = await (f.service.findAll as any)({}, 'actor-1');
    expect(JSON.stringify(list.data)).not.toContain('secret');
    expect(list.data[0].changedFields.map((x: any) => x.field)).toEqual([
      'name',
    ]);
  });
  it('list/count/distinct share the Case authorization predicate before matching', async () => {
    const f = fixture();
    await (f.service.findAll as any)({}, 'actor-1');
    const where = f.db.auditLog.findMany.mock.calls[0][0].where;
    expect(where).toBeDefined();
    expect(JSON.stringify(where)).toContain('Case');
    expect(JSON.stringify(where)).toContain('c1');
    expect(f.db.auditLog.count).toHaveBeenCalledWith({ where });
    await (f.service.distinctActions as any)('actor-1');
    expect(f.db.auditLog.findMany.mock.calls.at(-1)[0].where).toEqual(where);
  });
  it('Case audit without an actor cannot use scope-null administrator fallback', async () => {
    const f = fixture();
    await expect(f.service.findById('audit1')).rejects.toMatchObject({
      status: 403,
    });
  });
});
