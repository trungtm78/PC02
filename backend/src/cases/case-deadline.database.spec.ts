import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../common/testing/scratch-database';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { CasesService } from './cases.service';
import type { CreateCaseDto } from './dto/create-case.dto';

/**
 * REGRESSION CONTRACT: the deadline of a case (Vụ án) as `CasesService` writes it TODAY, on a real PostgreSQL.
 *
 * A case gets NO deadline of its own accord when it is created or edited: the column holds what the caller sent.
 * (The governed legal workflow, `cases/governance/legal-workflow.service.ts`, is the other writer of this column; it
 * is not exercised here.)
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('the deadline of a case, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  let cases: CasesService;
  let permissions: EnsuredPermissions;
  const tag = `cdl-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let n = 0;

  const create = async (over: Partial<CreateCaseDto> = {}) => {
    n += 1;
    const dto = { name: `${tag} vụ án ${n}`, caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: id.team, investigatorId: id.officer, ...over };
    const result = await cases.create(dto as CreateCaseDto, id.officer);
    return (result as { data: { id: string } }).data.id;
  };
  const stored = (caseId: string) => scratch.db.case.findUniqueOrThrow({ where: { id: caseId } });
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    // The case services ask the database what the actor may do: the role holds the case permissions.
    // Permission rows are the whole database's: the ones this suite has to create are taken back at the end.
    permissions = await ensurePermissions(scratch, ['read:Case', 'create:Case', 'edit:Case', 'write:Case']);
    const permissionIds = Object.values(permissions.ids);
    const role = await db.role.create({
      data: { name: `${tag}-officer`, permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) } },
    });
    id.officer = (await db.user.create({ data: { username: `${tag}-officer`, passwordHash: 'x', roleId: role.id } })).id;
    id.team = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ` } })).id;
    await db.userTeam.create({ data: { userId: id.officer, teamId: id.team } });
    const documentType = `CASE_SPEC_${tag}`;
    id.template = (
      await db.documentNumberTemplate.create({
        data: {
          name: `${tag} codes`,
          documentType,
          createdById: id.officer,
          segments: [{ type: 'LITERAL', value: tag }, { type: 'COUNTER' }],
          counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 6 },
        },
      })
    ).id;
    const numbers = new DocumentNumbersService(db as never);
    const ownNumbers = {
      commitWithTx: (_type: string, context: { userId: string }, tx: Prisma.TransactionClient) =>
        numbers.commitWithTx(documentType, context, tx),
    };
    cases = new CasesService(db as never, new AuditService(db as never), {} as never, ownNumbers as never, { emit: () => false } as never);
  });

  afterAll(async () => {
    const { db } = scratch;
    const mine = await db.case.findMany({ where: { name: { startsWith: tag } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: id.officer }, { subjectId: { in: mine.map((m) => m.id) } }] } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.documentNumberLog.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberTemplate.deleteMany({ where: { id: id.template } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  it('a new case gets no deadline of its own accord', async () => {
    const row = await stored(await create());
    expect(row.deadline).toBeNull();
  });

  it('a deadline sent with a new case is stored as sent', async () => {
    const row = await stored(await create({ deadline: '2026-09-01' }));
    expect(iso(row.deadline)).toBe('2026-09-01T00:00:00.000Z');
  });

  it('no date of a new case produces a deadline: received, proposed, assigned to the unit, prosecuted', async () => {
    const row = await stored(
      await create({
        receiveDate: '2026-01-05',
        ngayDeXuat: '2026-01-06',
        ngayGiaoDonViGiaiQuyet: '2026-01-07',
        ngayKhoiTo: '2026-01-08',
        loaiThongTin: `Tố giác ${tag}`,
      } as never),
    );
    expect(iso(row.ngayKhoiTo)).toBe('2026-01-08T00:00:00.000Z');
    expect(row.deadline).toBeNull();
  });

  it('a case has no column for the rule behind its deadline and none for extensions of it', () => {
    const columns = Object.keys(Prisma.CaseScalarFieldEnum);
    expect(columns).toContain('deadline');
    expect(columns).not.toContain('deadlineRuleVersionId');
    expect(columns).not.toContain('maxExtensionsSnapshot');
    expect(columns).not.toContain('ngayGiaHan');
  });

  describe('editing (PUT /cases/:id)', () => {
    const edit = (caseId: string, dto: Record<string, unknown>) => cases.update(caseId, dto as never, id.officer);

    it('a deadline sent with an edit replaces the deadline as sent', async () => {
      const caseId = await create({ deadline: '2026-09-01' });
      await edit(caseId, { deadline: '2026-10-15' });
      expect(iso((await stored(caseId)).deadline)).toBe('2026-10-15T00:00:00.000Z');
    });

    it('an edit that sends an empty deadline clears it', async () => {
      const caseId = await create({ deadline: '2026-09-01' });
      await edit(caseId, { deadline: '' });
      expect((await stored(caseId)).deadline).toBeNull();
    });

    it('an edit that does not mention the deadline leaves it alone', async () => {
      const caseId = await create({ deadline: '2026-09-01' });
      await edit(caseId, { unit: `${tag} đơn vị` });
      expect(iso((await stored(caseId)).deadline)).toBe('2026-09-01T00:00:00.000Z');
    });

    it('giving a case its dates afterwards does not give it a deadline', async () => {
      const caseId = await create();
      await edit(caseId, { ngayDeXuat: '2026-01-06', ngayKhoiTo: '2026-01-08' });
      const row = await stored(caseId);
      expect(iso(row.ngayKhoiTo)).toBe('2026-01-08T00:00:00.000Z');
      expect(row.deadline).toBeNull();
    });
  });
});
