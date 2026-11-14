import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  dropOwnDeadlineRules,
  openScratchDatabase,
  ownActiveDeadlineRules,
  replaceOwnDeadlineRule,
  type ScratchDatabase,
} from '../common/testing/scratch-database';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

/**
 * REGRESSION CONTRACT: the deadline of an incident (Vụ việc) as the system computes and writes it TODAY, on a real
 * PostgreSQL. A record that has no processing flow must keep exactly this once flows exist.
 *
 * These tests state what the code does, including what looks odd; they do not say it is right.
 *
 * Everything is the real thing (the service, the audit log, the deadline rules, the number generator). Two things
 * belong to this suite alone: the active rule versions (added under a turn on the shared rows, see
 * `ownActiveDeadlineRules`) and the number template (a document type of its own, so that no counter of the database
 * is advanced).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('the deadline of an incident, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  let incidents: IncidentsService;
  const tag = `idl-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let rules: Record<'THOI_HAN_XAC_MINH' | 'THOI_HAN_GIA_HAN_1' | 'THOI_HAN_GIA_HAN_2' | 'SO_LAN_GIA_HAN_TOI_DA', { id: string; value: number }>;
  let n = 0;

  /** A new incident through the service, with a name no other record has (a same-name record asks for a review). */
  const create = async (over: Partial<CreateIncidentDto> = {}) => {
    n += 1;
    const result = await incidents.create({ name: `${tag} vụ việc ${n}`, ...over } as CreateIncidentDto, id.officer);
    return result.data.id;
  };
  const stored = (incidentId: string) => scratch.db.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    // On purpose NOT the values of the law today (20 days, two extensions of 60): a product that had those numbers
    // written into it, instead of reading the active rule, must not pass.
    rules = await ownActiveDeadlineRules(scratch, tag, {
      THOI_HAN_XAC_MINH: 17,
      THOI_HAN_GIA_HAN_1: 41,
      THOI_HAN_GIA_HAN_2: 53,
      SO_LAN_GIA_HAN_TOI_DA: 3,
    });

    const role = await db.role.create({ data: { name: `${tag}-officer` } });
    id.officer = (await db.user.create({ data: { username: `${tag}-officer`, passwordHash: 'x', roleId: role.id } })).id;
    id.investigator = (await db.user.create({ data: { username: `${tag}-investigator`, passwordHash: 'x', roleId: role.id } })).id;
    id.team = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ` } })).id;
    await db.userTeam.create({ data: { userId: id.investigator, teamId: id.team } });

    const documentType = `INCIDENT_SPEC_${tag}`;
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
    // The real generator, on this suite's template: the service asks for 'INCIDENT', whose counter is everybody's.
    const ownNumbers = {
      commitWithTx: (_type: string, context: { userId: string }, tx: Prisma.TransactionClient) =>
        numbers.commitWithTx(documentType, context, tx),
    };
    const audit = new AuditService(db as never);
    incidents = new IncidentsService(
      db as never,
      audit,
      {} as never,
      new DeadlineRulesService(db as never, audit, {} as never),
      ownNumbers as never,
      { emit: () => false } as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(async () => {
    const { db } = scratch;
    const mine = await db.incident.findMany({ where: { code: { startsWith: tag } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: [id.officer, id.investigator] } }, { subjectId: { in: mine.map((m) => m.id) } }] } });
    await db.incidentStatusHistory.deleteMany({ where: { incidentId: { in: mine.map((m) => m.id) } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.documentNumberLog.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberTemplate.deleteMany({ where: { id: id.template } });
    await dropOwnDeadlineRules(scratch, tag);
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  describe('at creation', () => {
    it('an incident without a proposal date gets no deadline and no rule version', async () => {
      const row = await stored(await create());
      expect(row.deadline).toBeNull();
      expect(row.deadlineRuleVersionId).toBeNull();
    });

    it('with a proposal date, the deadline is that date plus the days of the active verification rule (here 17)', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-05' }));
      expect(iso(row.deadline)).toBe('2026-01-22T00:00:00.000Z');
    });

    it('it records which rule version gave the deadline', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-06' }));
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_XAC_MINH.id);
    });

    it('a proposal date given as a day is stored at 00:00 UTC, and so is the deadline', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-07' }));
      expect(iso(row.ngayDeXuat)).toBe('2026-01-07T00:00:00.000Z');
      expect(iso(row.deadline)).toBe('2026-01-24T00:00:00.000Z');
    });

    it('a proposal date given with a time of day keeps that time of day in the deadline', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-08T09:30:00+07:00' }));
      expect(iso(row.deadline)).toBe('2026-01-25T02:30:00.000Z');
    });

    it('the date the source report was received plays no part: without a proposal date there is still no deadline', async () => {
      const row = await stored(await create({ ngayTiepNhanNguonTin: '2026-01-02' }));
      expect(iso(row.ngayTiepNhanNguonTin)).toBe('2026-01-02T00:00:00.000Z');
      expect(row.deadline).toBeNull();
    });

    it('a deadline sent with the record is stored as sent, and no rule version is recorded', async () => {
      const row = await stored(await create({ deadline: '2026-03-15' }));
      expect(iso(row.deadline)).toBe('2026-03-15T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBeNull();
    });

    it('a deadline sent with the record wins over the proposal date: nothing is computed', async () => {
      const row = await stored(await create({ deadline: '2026-03-16T10:00:00.000Z', ngayDeXuat: '2026-01-09' }));
      expect(iso(row.deadline)).toBe('2026-03-16T10:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBeNull();
    });

    it('every new incident freezes the maximum number of extensions of that day (here 3), with or without a deadline', async () => {
      expect((await stored(await create())).maxExtensionsSnapshot).toBe(3);
      expect((await stored(await create({ ngayDeXuat: '2026-01-10' }))).maxExtensionsSnapshot).toBe(3);
      expect((await stored(await create({ deadline: '2026-03-17' }))).maxExtensionsSnapshot).toBe(3);
    });

    it('a new incident has not been extended', async () => {
      const row = await stored(await create({ ngayDeXuat: '2026-01-11' }));
      expect(row).toMatchObject({ soLanGiaHan: 0, ngayGiaHan: null, giaHan1RuleVersionId: null, giaHan2RuleVersionId: null });
    });
  });

  describe('extending (POST /incidents/:id/extend)', () => {
    it('the first extension adds the days of the first-extension rule (here 41) to the deadline', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      const before = new Date();
      const result = await incidents.extendDeadline(incidentId, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-03-04T00:00:00.000Z');
      expect(row.soLanGiaHan).toBe(1);
      expect(row.giaHan1RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_1.id);
      expect(row.giaHan2RuleVersionId).toBeNull();
      // The day of the extension is the moment of the call.
      expect(row.ngayGiaHan!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(row.ngayGiaHan!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      expect(result.message).toBe('Gia hạn lần 1 thành công');
    });

    it('the second extension adds the days of the second-extension rule (here 53) and records that rule version', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      await incidents.extendDeadline(incidentId, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-04-26T00:00:00.000Z');
      expect(row.soLanGiaHan).toBe(2);
      expect(row.giaHan1RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_1.id);
      expect(row.giaHan2RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_2.id);
    });

    it('when the maximum allows a third extension, it uses the second-extension rule again', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      await incidents.extendDeadline(incidentId, id.officer);
      const result = await incidents.extendDeadline(incidentId, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-06-18T00:00:00.000Z');
      expect(row.soLanGiaHan).toBe(3);
      expect(row.giaHan2RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_2.id);
      expect(result.message).toBe('Gia hạn lần 3 thành công');
    });

    it('extending does not change the rule version of the first deadline', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      expect((await stored(incidentId)).deadlineRuleVersionId).toBe(rules.THOI_HAN_XAC_MINH.id);
    });

    it('an extension past the frozen maximum is refused, and nothing changes', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      for (let i = 0; i < 3; i += 1) await incidents.extendDeadline(incidentId, id.officer);
      const before = await stored(incidentId);
      await expect(incidents.extendDeadline(incidentId, id.officer)).rejects.toMatchObject({
        status: 400,
        message: 'Đã gia hạn tối đa 3 lần theo Điều 147 BLTTHS 2015',
      });
      const after = await stored(incidentId);
      expect({ deadline: iso(after.deadline), soLanGiaHan: after.soLanGiaHan, updatedAt: iso(after.updatedAt) }).toEqual({
        deadline: iso(before.deadline),
        soLanGiaHan: 3,
        updatedAt: iso(before.updatedAt),
      });
    });

    it('the days of an extension are those of the rule active WHEN it is granted: a rule changed between two extensions applies to the second', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      const changed = await replaceOwnDeadlineRule(scratch, tag, 'THOI_HAN_GIA_HAN_2', 29);
      try {
        await incidents.extendDeadline(incidentId, id.officer);
        const row = await stored(incidentId);
        // 5 Jan + 17 (verification) + 41 (first extension, old rule) + 29 (second extension, NEW rule).
        expect(iso(row.deadline)).toBe('2026-04-02T00:00:00.000Z');
        expect(row.giaHan1RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_1.id);
        expect(row.giaHan2RuleVersionId).toBe(changed.id);
      } finally {
        await scratch.db.incident.update({ where: { id: incidentId }, data: { giaHan2RuleVersionId: null } });
        await changed.undo();
      }
    });

    it('the maximum stays what it was when the incident was created: lowering the rule afterwards does not take extensions away', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      const lowered = await replaceOwnDeadlineRule(scratch, tag, 'SO_LAN_GIA_HAN_TOI_DA', 1);
      try {
        await incidents.extendDeadline(incidentId, id.officer);
        await incidents.extendDeadline(incidentId, id.officer);
        const row = await stored(incidentId);
        expect(row.maxExtensionsSnapshot).toBe(3);
        expect(row.soLanGiaHan).toBe(2);
        expect(iso(row.deadline)).toBe('2026-04-26T00:00:00.000Z');
        // An incident created under the lowered rule freezes the lowered maximum, and gets one extension only.
        const later = await create({ ngayDeXuat: '2026-01-05' });
        expect((await stored(later)).maxExtensionsSnapshot).toBe(1);
        await incidents.extendDeadline(later, id.officer);
        await expect(incidents.extendDeadline(later, id.officer)).rejects.toMatchObject({
          status: 400,
          message: 'Đã gia hạn tối đa 1 lần theo Điều 147 BLTTHS 2015',
        });
      } finally {
        await lowered.undo();
      }
    });

    it('the days of the first deadline are those of the rule active when the incident is created: a changed rule applies to new incidents only', async () => {
      const earlier = await create({ ngayDeXuat: '2026-01-05' });
      const changed = await replaceOwnDeadlineRule(scratch, tag, 'THOI_HAN_XAC_MINH', 23);
      let later: string | undefined;
      try {
        later = await create({ ngayDeXuat: '2026-01-05' });
        const row = await stored(later);
        expect(iso(row.deadline)).toBe('2026-01-28T00:00:00.000Z');
        expect(row.deadlineRuleVersionId).toBe(changed.id);
        expect(iso((await stored(earlier)).deadline)).toBe('2026-01-22T00:00:00.000Z');
      } finally {
        if (later) await scratch.db.incident.update({ where: { id: later }, data: { deadlineRuleVersionId: null } });
        await changed.undo();
      }
    });

    it('an incident with nothing frozen (created before the snapshot existed) takes the maximum of the active rule', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await scratch.db.incident.update({ where: { id: incidentId }, data: { maxExtensionsSnapshot: null } });
      for (let i = 0; i < 3; i += 1) await incidents.extendDeadline(incidentId, id.officer);
      await expect(incidents.extendDeadline(incidentId, id.officer)).rejects.toMatchObject({ status: 400 });
      expect((await stored(incidentId)).soLanGiaHan).toBe(3);
    });

    it('an incident without a deadline cannot be extended', async () => {
      const incidentId = await create();
      await expect(incidents.extendDeadline(incidentId, id.officer)).rejects.toMatchObject({
        status: 400,
        message: 'Vụ việc chưa có thời hạn — không thể gia hạn',
      });
      expect((await stored(incidentId)).soLanGiaHan).toBe(0);
    });

    it('a deadline that was typed in (no rule behind it) is extended like any other', async () => {
      const incidentId = await create({ deadline: '2026-03-15' });
      await incidents.extendDeadline(incidentId, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-04-25T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBeNull();
      expect(row.giaHan1RuleVersionId).toBe(rules.THOI_HAN_GIA_HAN_1.id);
    });

    it('a deadline already past is extended from the old deadline, not from today', async () => {
      const incidentId = await create({ ngayDeXuat: '2020-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      expect(iso((await stored(incidentId)).deadline)).toBe('2020-03-03T00:00:00.000Z');
    });

    it('an incident still waiting to be received by its unit cannot be extended', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await scratch.db.incident.update({ where: { id: incidentId }, data: { intakeStage: 'PHAN_LOAI' } });
      await expect(incidents.extendDeadline(incidentId, id.officer)).rejects.toMatchObject({ status: 400 });
      expect((await stored(incidentId)).soLanGiaHan).toBe(0);
    });

    it('an incident that does not exist answers 404', async () => {
      await expect(incidents.extendDeadline(`${tag}-missing`, id.officer)).rejects.toMatchObject({ status: 404 });
    });

    it('two extensions at the same moment, one left: exactly one is granted and the deadline moves once', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await scratch.db.incident.update({ where: { id: incidentId }, data: { maxExtensionsSnapshot: 1 } });
      const results = await Promise.allSettled([
        incidents.extendDeadline(incidentId, id.officer),
        incidents.extendDeadline(incidentId, id.officer),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(refused.reason).toMatchObject({ status: 400 });
      const row = await stored(incidentId);
      expect(row.soLanGiaHan).toBe(1);
      expect(iso(row.deadline)).toBe('2026-03-04T00:00:00.000Z');
    });

    it('two extensions at the same moment, several left: the count and the deadline always agree with what was granted', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      const results = await Promise.allSettled([
        incidents.extendDeadline(incidentId, id.officer),
        incidents.extendDeadline(incidentId, id.officer),
      ]);
      const granted = results.filter((r) => r.status === 'fulfilled').length;
      expect(granted).toBeGreaterThanOrEqual(1);
      const row = await stored(incidentId);
      // One granted: +41 days. Both granted (the second read after the first wrote): +41 +53. Never a lost update.
      expect(row.soLanGiaHan).toBe(granted);
      expect(iso(row.deadline)).toBe(granted === 1 ? '2026-03-04T00:00:00.000Z' : '2026-04-26T00:00:00.000Z');
      expect(row.giaHan2RuleVersionId).toBe(granted === 2 ? rules.THOI_HAN_GIA_HAN_2.id : null);
    });
  });

  describe('editing (PUT /incidents/:id)', () => {
    it('a deadline sent with an edit replaces the deadline as sent', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.update(incidentId, { deadline: '2026-06-30' } as never, id.officer);
      expect(iso((await stored(incidentId)).deadline)).toBe('2026-06-30T00:00:00.000Z');
    });

    it('an edit that replaces a computed deadline leaves the rule version of the old one in place', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.update(incidentId, { deadline: '2026-06-30' } as never, id.officer);
      expect((await stored(incidentId)).deadlineRuleVersionId).toBe(rules.THOI_HAN_XAC_MINH.id);
    });

    it('an edit that sends an empty deadline clears it, and the rule version stays', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.update(incidentId, { deadline: null } as never, id.officer);
      const row = await stored(incidentId);
      expect(row.deadline).toBeNull();
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_XAC_MINH.id);
    });

    it('an edit that does not mention the deadline leaves it alone', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.update(incidentId, { description: `${tag} sửa nội dung` } as never, id.officer);
      expect(iso((await stored(incidentId)).deadline)).toBe('2026-01-22T00:00:00.000Z');
    });

    it('changing the proposal date afterwards does NOT recompute the deadline', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.update(incidentId, { ngayDeXuat: '2026-02-10' } as never, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.ngayDeXuat)).toBe('2026-02-10T00:00:00.000Z');
      expect(iso(row.deadline)).toBe('2026-01-22T00:00:00.000Z');
    });

    it('giving a proposal date to an incident that had none does NOT give it a deadline', async () => {
      const incidentId = await create();
      await incidents.update(incidentId, { ngayDeXuat: '2026-02-11' } as never, id.officer);
      const row = await stored(incidentId);
      expect(row.deadline).toBeNull();
      expect(row.deadlineRuleVersionId).toBeNull();
    });

    it('an edit does not touch the extension count', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.extendDeadline(incidentId, id.officer);
      await incidents.update(incidentId, { deadline: '2026-06-30' } as never, id.officer);
      expect((await stored(incidentId)).soLanGiaHan).toBe(1);
    });
  });

  describe('assigning (PATCH /incidents/:id/assign)', () => {
    it('a deadline sent with the assignment replaces the deadline as sent, and the rule version stays', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.assignInvestigator(incidentId, { assignedTeamId: id.team, investigatorId: id.investigator, deadline: '2026-07-01' }, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-07-01T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBe(rules.THOI_HAN_XAC_MINH.id);
      expect(row).toMatchObject({ assignedTeamId: id.team, investigatorId: id.investigator, status: 'DANG_XAC_MINH' });
    });

    it('an assignment without a deadline keeps the deadline the incident had', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.assignInvestigator(incidentId, { assignedTeamId: id.team, investigatorId: id.investigator }, id.officer);
      expect(iso((await stored(incidentId)).deadline)).toBe('2026-01-22T00:00:00.000Z');
    });

    it('an assignment without a deadline gives none to an incident that had none', async () => {
      const incidentId = await create();
      await incidents.assignInvestigator(incidentId, { assignedTeamId: id.team }, id.officer);
      expect((await stored(incidentId)).deadline).toBeNull();
    });

    it('an assignment gives a deadline to an incident that had none, when it sends one', async () => {
      const incidentId = await create();
      await incidents.assignInvestigator(incidentId, { assignedTeamId: id.team, deadline: '2026-07-02' }, id.officer);
      const row = await stored(incidentId);
      expect(iso(row.deadline)).toBe('2026-07-02T00:00:00.000Z');
      expect(row.deadlineRuleVersionId).toBeNull();
    });

    it('an assignment cannot clear a deadline: an empty one is read as "not sent"', async () => {
      const incidentId = await create({ ngayDeXuat: '2026-01-05' });
      await incidents.assignInvestigator(incidentId, { assignedTeamId: id.team, deadline: '' }, id.officer);
      expect(iso((await stored(incidentId)).deadline)).toBe('2026-01-22T00:00:00.000Z');
    });
  });
});
