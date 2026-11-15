import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { NotificationEventService } from '../../notifications/notification-event.service';
import { DeadlineScheduler } from '../../scheduler/deadline.scheduler';
import { TeamsService } from '../../teams/teams.service';
import { bandInstants } from '../engine/bands';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { recordLink } from '../records/record-alert';
import { RecordStepAccessService } from '../records/record-step-access.service';
import { ProcessingReminderService, REMINDERS_SWITCH, STEP_NUDGED } from './processing-reminder.service';

/**
 * The reminders of the processing flow on a REAL PostgreSQL: what is decided, for whom, once; what a dying process
 * leaves behind; and what the switch does.
 *
 * The database is shared with other suites running at the same time: every row carries the tag of this run, the service
 * is narrowed to the records of this suite (`onlyRecordIds`), nothing is truncated, and only its own rows are removed.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const T = { redDays: 1, yellowDays: 2, greenDays: 3 };
/** A December 2026 day at 10:00 in Vietnam. */
const at = (day: number, hourUtc = 3) => new Date(`2026-12-${String(day).padStart(2, '0')}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`);
/** The end of a December day in Vietnam. */
const endOf = (day: number) => new Date(`2026-12-${String(day).padStart(2, '0')}T16:59:59.999Z`);
const NOW = at(10);

type Role = 'MAIN' | 'CHECK' | 'COORDINATE' | 'INFORM';
interface StepSpec {
  due?: Date;
  status?: 'OPEN' | 'REPORTED' | 'DONE';
  config?: 'plain' | 'escalating';
  parties?: Array<{ teamId?: string; role?: Role; assigneeUserId?: string }>;
}

run('The reminders of the processing flow on PostgreSQL', () => {
  jest.setTimeout(240_000);
  let scratch: ScratchDatabase;
  let gateway: RecordGateway;
  let events: NotificationEventService;
  let reminders: ProcessingReminderService;
  let permissions: EnsuredPermissions;
  let remindersOn = true;
  const flags = { isEnabled: (key: string) => Promise.resolve(key === REMINDERS_SWITCH ? remindersOn : true) } as never;
  const bell = jest.fn();
  const tag = `rem-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const recordIds: string[] = [];
  let flowConfig = { flowId: '', versionId: '' };
  const stepConfig: Record<string, string> = {};
  let counter = 0;

  const petition = async (over: Record<string, unknown> = {}): Promise<string> => {
    const n = ++counter;
    const row = await scratch.db.petition.create({
      data: { stt: `${tag}-p${n}`, receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender ${n}`, loaiThongTin: 'Tố cáo', enteredById: id.owner, assignedTeamId: id.T, status: 'DANG_XU_LY', ...over } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };

  /** The flow of a record with ONE step being worked, written as rows. Answers the id of the step. */
  const stepOn = async (kind: RecordKind, recordId: string, spec: StepSpec = {}): Promise<string> => {
    const { db } = scratch;
    const due = spec.due ?? endOf(13);
    const status = spec.status ?? 'OPEN';
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL' } });
    const step = await db.procRecordStep.create({
      data: {
        recordFlowId: flow.id,
        recordKind: kind,
        recordId,
        stepId: stepConfig[spec.config ?? 'plain'],
        stepKey: 'k1',
        order: 0,
        status,
        startAt: new Date('2026-12-01T00:00:00Z'),
        regulatoryDueAt: due,
        internalDueAt: due,
        ...bandInstants(due, T),
        ...(status === 'DONE' ? { doneAt: NOW } : {}),
        parties: { create: (spec.parties ?? [{}]).map((party, order) => ({ partyKind: 'TEAM' as const, teamId: party.teamId ?? id.T, role: party.role ?? 'MAIN', assigneeUserId: party.assigneeUserId, order })) },
      },
    });
    return step.id;
  };

  /** A petition with one step: the usual subject of a test. */
  const work = async (spec: StepSpec = {}, over: Record<string, unknown> = {}) => {
    const recordId = await petition(over);
    const stepId = await stepOn('PETITION', recordId, spec);
    return { recordId, stepId };
  };

  /** A person changes the deadline: the instants follow and the revision goes up, as the command layer does. */
  const moveDeadline = (stepId: string, due: Date) =>
    scratch.db.procRecordStep.update({ where: { id: stepId }, data: { regulatoryDueAt: due, internalDueAt: due, ...bandInstants(due, T), deadlineRevision: { increment: 1 } } });

  const rowsOf = (recordId: string) => scratch.db.procReminder.findMany({ where: { recordId }, orderBy: [{ createdAt: 'asc' }, { dedupeKey: 'asc' }] });

  /** The notices about a record, as (person, band or kind), in the order they were written. */
  const noticesOf = async (recordId: string) => {
    const people = Object.fromEntries(Object.entries(id).map(([name, value]) => [value, name]));
    const rows = await scratch.db.notification.findMany({ where: { userId: { in: Object.keys(people) } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows
      .filter((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        return metadata.petitionId === recordId || metadata.caseId === recordId;
      })
      .map((row) => ({ to: people[row.userId], type: row.type as string, title: row.title, message: row.message, link: row.link, metadata: row.metadata as Record<string, unknown> }));
  };
  const toWhom = async (recordId: string) => (await noticesOf(recordId)).map((notice) => notice.to).sort();

  const service = (notifier: Pick<NotificationEventService, 'deliverInApp' | 'ringBell'> = events) => {
    const made = new ProcessingReminderService(scratch.db as never, flags, gateway, notifier as never);
    made.onlyRecordIds = recordIds;
    made.onlyUserIds = Object.values(id);
    return made;
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    const keys = ['read:Petition', 'read:Case', 'approve:ProcessingStep'];
    permissions = await ensurePermissions(scratch, keys);
    const grant = (...names: string[]) => ({ create: names.map((key) => ({ permissionId: permissions.ids[key] })) });
    const officer = await db.role.create({ data: { name: `${tag}-officer`, permissions: grant('read:Petition', 'read:Case') } });
    const bare = await db.role.create({ data: { name: `${tag}-bare` } });
    const leadership = await db.role.create({ data: { name: `${tag}-leadership`, permissions: grant('read:Petition', 'read:Case', 'approve:ProcessingStep') } });

    const person = async (who: string, roleId: string, over: Record<string, unknown> = {}) => {
      id[who] = (await db.user.create({ data: { username: `${tag}-${who}`, passwordHash: 'x', roleId, isActive: true, ...over } })).id;
    };
    await person('owner', officer.id);
    await person('lead', officer.id);
    await person('member', officer.id);
    await person('retired', officer.id, { isActive: false });
    await person('parentLead', officer.id);
    await person('informLead', officer.id);
    await person('checkLead', officer.id);
    await person('bareLead', bare.id);
    await person('boss', leadership.id, { canDispatch: true });
    await person('bossElsewhere', leadership.id);
    await person('actor', officer.id, { canDispatch: true });

    const team = async (code: string, parentId?: string) => {
      id[code] = (await db.team.create({ data: { code: `${tag}-${code}`, name: `${tag} unit ${code}`, parentId } })).id;
    };
    // P is above T (the unit that holds and works the records); I is informed; C checks; B is headed by a person who may
    // read nothing; E is elsewhere.
    await team('P');
    await team('T', id.P);
    for (const code of ['I', 'C', 'B', 'E', 'O']) await team(code);
    await db.userTeam.createMany({
      data: [
        { userId: id.owner, teamId: id.O },
        { userId: id.lead, teamId: id.T, isLeader: true },
        { userId: id.retired, teamId: id.T, isLeader: true },
        { userId: id.member, teamId: id.T },
        { userId: id.parentLead, teamId: id.P, isLeader: true },
        { userId: id.informLead, teamId: id.I, isLeader: true },
        { userId: id.checkLead, teamId: id.C, isLeader: true },
        { userId: id.bareLead, teamId: id.B, isLeader: true },
        { userId: id.bossElsewhere, teamId: id.E },
      ],
    });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.owner, updatedById: id.owner } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.owner } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    const base = { versionId: version.id, durationValue: 5, durationUnit: 'DAY' as const, anchor: 'RECEIVED' as const, ...T };
    stepConfig.plain = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k1', order: 0, name: `${tag} Verify` } })).id;
    stepConfig.escalating = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k2', order: 1, name: `${tag} Settle`, escalateAfterDays: 3, escalateLeadershipAfterDays: 7 } })).id;

    const prisma = db as never;
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, new AuditService(prisma), {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    events = new NotificationEventService(prisma, { notifyUser: bell } as never, {} as never);
    reminders = service();
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const people = Object.entries(id).filter(([name]) => name.length > 1).map(([, value]) => value);
    const flows = { flowId: flowConfig.flowId };
    await db.procReminder.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.notification.deleteMany({ where: { userId: { in: people } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordPause.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { userId: { in: people } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag }, parentId: { not: null } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  beforeEach(() => {
    remindersOn = true;
    bell.mockClear();
  });

  describe('each band once, and only the band the step is in', () => {
    it('green, yellow, red: one notice when the band is entered, none on a second tick, with the link to the assignment tab', async () => {
      const { recordId } = await work({ due: endOf(13) });
      const seen = async () => (await noticesOf(recordId)).map((notice) => notice.metadata.band);

      expect(await reminders.tick(NOW)).toMatchObject({ ran: true });
      expect(await seen()).toEqual(['GREEN']);
      await reminders.tick(at(10, 9));
      expect(await seen()).toEqual(['GREEN']);

      await reminders.tick(at(11));
      await reminders.tick(at(11, 5));
      expect(await seen()).toEqual(['GREEN', 'YELLOW']);

      await reminders.tick(at(12));
      await reminders.tick(at(12, 5));
      expect(await seen()).toEqual(['GREEN', 'YELLOW', 'RED']);

      const notices = await noticesOf(recordId);
      expect(notices.map((notice) => notice.to)).toEqual(['lead', 'lead', 'lead']);
      expect(notices[0]).toMatchObject({ type: 'PETITION_DEADLINE_NEAR', link: `/petitions/${recordId}?tab=phan-cong-xu-ly` });
      expect(notices[0].message).toContain('còn 3 ngày');
      expect(bell).toHaveBeenCalledWith(id.lead);
    });

    it('overdue: once every civil day in Vietnam, not twice on the same day', async () => {
      const { recordId } = await work({ due: endOf(8) });
      await reminders.tick(NOW);
      await reminders.tick(at(10, 9));
      // 16:30 UTC is still the 10th in Vietnam; 17:30 UTC is the 11th.
      await reminders.tick(new Date('2026-12-10T16:30:00.000Z'));
      expect(await noticesOf(recordId)).toHaveLength(1);
      await reminders.tick(new Date('2026-12-10T17:30:00.000Z'));
      await reminders.tick(at(11));
      const notices = await noticesOf(recordId);
      expect(notices.map((notice) => notice.type)).toEqual(['PETITION_OVERDUE', 'PETITION_OVERDUE']);
      expect(notices[0].message).toContain('đã quá hạn 2 ngày');
    });

    it('a step first seen in red gets the red reminder alone: the bands it passed are not sent after the fact', async () => {
      const { recordId } = await work({ due: endOf(11) });
      await reminders.tick(NOW);
      expect((await rowsOf(recordId)).map((row) => row.band)).toEqual(['RED']);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });

    it('a step that is not near its deadline yet gets nothing', async () => {
      const { recordId } = await work({ due: endOf(25) });
      await reminders.tick(NOW);
      expect(await rowsOf(recordId)).toHaveLength(0);
    });

    it('two runners at once: one tick does the work, the key is written once', async () => {
      const { recordId } = await work({ due: endOf(13) });
      const results = await Promise.all([reminders.tick(NOW), service().tick(NOW), service().tick(NOW)]);
      expect(results.some((result) => result.ran)).toBe(true);
      expect(await rowsOf(recordId)).toHaveLength(1);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });
  });

  describe('a changed deadline', () => {
    it('is reminded again, and going back to the first deadline (A -> B -> A) is reminded once more', async () => {
      const { recordId, stepId } = await work({ due: endOf(13) });
      await reminders.tick(NOW);
      await moveDeadline(stepId, endOf(12));
      await reminders.tick(NOW);
      await reminders.tick(NOW);
      await moveDeadline(stepId, endOf(13));
      await reminders.tick(NOW);
      await reminders.tick(NOW);
      expect((await rowsOf(recordId)).map((row) => [row.deadlineRevision, row.band])).toEqual([[1, 'GREEN'], [2, 'YELLOW'], [3, 'GREEN']]);
      expect(await noticesOf(recordId)).toHaveLength(3);
    });

    it('a reminder decided for a deadline that changed before it was delivered is dropped as stale', async () => {
      const { recordId, stepId } = await work({ due: endOf(13) });
      expect(await reminders.plan(NOW)).toBeGreaterThanOrEqual(1);
      await moveDeadline(stepId, endOf(25));
      await reminders.deliver(NOW);
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'STALE' }]);
      expect(await noticesOf(recordId)).toHaveLength(0);
    });
  });

  describe('a process that dies', () => {
    it('between the mark and the delivery: the row waits, the next process delivers it once', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', attempts: 0, recipientId: id.lead }]);
      expect(await noticesOf(recordId)).toHaveLength(0);

      // Another process, later.
      const next = service();
      await next.deliver(at(10, 4));
      await next.deliver(at(10, 5));
      await next.tick(at(10, 6));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', attempts: 1 }]);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });

    it('in the middle of a delivery: the notice and the mark "done" are one transaction, so the retry sends exactly one', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      const dying = service({
        deliverInApp: async (payload, db) => {
          await events.deliverInApp(payload, db);
          throw new Error('the process died');
        },
        ringBell: () => undefined,
      });
      expect(await dying.deliver(NOW)).toMatchObject({ sent: 0, retried: 1 });
      const [row] = await rowsOf(recordId);
      expect(row).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'the process died' });
      expect(row.availableAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(await noticesOf(recordId)).toHaveLength(0);

      // Not before its pause is over; then once.
      await reminders.deliver(NOW);
      expect(await noticesOf(recordId)).toHaveLength(0);
      await reminders.deliver(at(10, 5));
      await reminders.deliver(at(10, 6));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', attempts: 2, lastError: null }]);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });
  });

  describe('the switch', () => {
    it('off: the tick reads and writes nothing, and the legacy reminder leaves no record out', async () => {
      const { recordId } = await work({ due: endOf(8) });
      remindersOn = false;
      expect(await reminders.tick(NOW)).toEqual({ ran: false, planned: 0, delivered: { sent: 0, dropped: 0, retried: 0, dead: 0 } });
      expect(await rowsOf(recordId)).toHaveLength(0);
      expect(await noticesOf(recordId)).toHaveLength(0);

      // The legacy scheduler asks the SAME switch at run time which records to leave to these reminders.
      const legacy = new DeadlineScheduler(scratch.db as never, {} as never, flags, { managedRecordIds: () => Promise.resolve([recordId]) } as never) as unknown as { managedExclusions(): Promise<Record<RecordKind, string[]> | null> };
      expect(await legacy.managedExclusions()).toBeNull();
      remindersOn = true;
      expect(await legacy.managedExclusions()).toMatchObject({ PETITION: [recordId] });
    });

    it('on -> off -> on: what was decided waits while off, nothing new is decided, and back on only the current band speaks', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      remindersOn = false;
      expect(await reminders.deliver(NOW)).toEqual({ sent: 0, dropped: 0, retried: 0, dead: 0 });
      // The yellow band comes and goes while the switch is off.
      await reminders.tick(at(11));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', band: 'GREEN' }]);
      expect(await noticesOf(recordId)).toHaveLength(0);

      remindersOn = true;
      await reminders.tick(at(12));
      await reminders.tick(at(12, 5));
      expect((await rowsOf(recordId)).map((row) => [row.band, row.status, row.outcome])).toEqual([['GREEN', 'DONE', 'SENT'], ['RED', 'DONE', 'SENT']]);
      expect(await noticesOf(recordId)).toHaveLength(2);
    });
  });

  describe('a record whose clock does not run', () => {
    it('finished, suspended, deleted, paused, or a step that is done: nothing', async () => {
      const finished = await work({ due: endOf(8) }, { status: 'DA_GIAI_QUYET' });
      const suspended = await work({ due: endOf(8) }, { status: 'TAM_DINH_CHI' });
      const deleted = await work({ due: endOf(8) }, { deletedAt: NOW });
      const done = await work({ due: endOf(8), status: 'DONE' });
      const paused = await work({ due: endOf(8) });
      const flow = await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId: paused.recordId } } });
      await scratch.db.procRecordPause.create({ data: { recordFlowId: flow.id, from: at(9), reason: 'SUSPENDED' } });

      await reminders.tick(NOW);
      for (const { recordId } of [finished, suspended, deleted, done, paused]) expect(await rowsOf(recordId)).toHaveLength(0);

      // The pause ends: the step speaks.
      await scratch.db.procRecordPause.updateMany({ where: { recordFlowId: flow.id }, data: { to: NOW } });
      await reminders.tick(NOW);
      expect(await noticesOf(paused.recordId)).toHaveLength(1);
    });

    it('a record finished after the reminder was decided: dropped when delivering, nothing sent', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DA_GIAI_QUYET' } });
      expect(await reminders.deliver(NOW)).toMatchObject({ sent: 0 });
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'STALE' }]);
      expect(await noticesOf(recordId)).toHaveLength(0);
    });
  });

  describe('who is told', () => {
    it('the person named on the work, and not the heads of the unit', async () => {
      const { recordId } = await work({ parties: [{ assigneeUserId: id.member }] });
      await reminders.tick(NOW);
      expect(await toWhom(recordId)).toEqual(['member']);
    });

    it('nobody named: the ACTIVE heads of the unit (a locked head is not told), for the main and the checking unit; a coordinating unit is not told', async () => {
      const { recordId } = await work({ parties: [{}, { teamId: id.C, role: 'CHECK' }, { teamId: id.I, role: 'COORDINATE' }] });
      await reminders.tick(NOW);
      expect(await toWhom(recordId)).toEqual(['checkLead', 'lead']);
    });

    it('a person who may not read the record is never told, named or head of a unit of the step', async () => {
      const headed = await work({ parties: [{}, { teamId: id.B, role: 'CHECK' }] });
      const named = await work({ parties: [{ assigneeUserId: id.bareLead }] });
      await reminders.tick(NOW);
      expect(await toWhom(headed.recordId)).toEqual(['lead']);
      expect(await rowsOf(named.recordId)).toHaveLength(0);
      expect(await scratch.db.notification.count({ where: { userId: id.bareLead } })).toBe(0);
    });

    it('a person who could read when it was decided and no longer can when it is delivered is not told', async () => {
      // Held by another unit: the member reaches it only because the step names them.
      const { recordId } = await work({ parties: [{ assigneeUserId: id.member }] }, { assignedTeamId: id.O });
      await reminders.plan(NOW);
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId } }, data: { assigneeUserId: id.owner, teamId: id.O } });
      await reminders.deliver(NOW);
      expect((await rowsOf(recordId)).filter((row) => row.recipientId === id.member)).toMatchObject([{ status: 'DONE', outcome: 'NOT_READABLE' }]);
      expect(await toWhom(recordId)).not.toContain('member');
    });

    it('an informed unit hears of a band once, and is not reminded every day of an overdue step', async () => {
      const { recordId } = await work({ due: endOf(8), parties: [{}, { teamId: id.I, role: 'INFORM' }] });
      await reminders.tick(NOW);
      await reminders.tick(at(11));
      await reminders.tick(at(12));
      expect(await toWhom(recordId)).toEqual(['informLead', 'lead', 'lead', 'lead']);
    });

    it('a person who switched the notice off gets none, and the row is finished, not retried', async () => {
      const { recordId } = await work({ due: endOf(8), parties: [{ assigneeUserId: id.member }] });
      const preference = await scratch.db.notificationPreference.create({ data: { userId: id.member, eventType: 'PETITION_OVERDUE', inApp: false, push: false } });
      try {
        await reminders.tick(NOW);
        expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SUPPRESSED' }]);
        expect(await noticesOf(recordId)).toHaveLength(0);
      } finally {
        await scratch.db.notificationPreference.delete({ where: { id: preference.id } });
      }
    });
  });

  describe('escalation', () => {
    it('overdue by the days the step says: once the heads of the parent unit, later once the people who approve, each only if they may read', async () => {
      const { recordId } = await work({ due: endOf(8), config: 'escalating' });
      const escalations = async () => (await rowsOf(recordId)).filter((row) => row.kind !== 'BAND').map((row) => [row.kind, Object.keys(id).find((name) => id[name] === row.recipientId)]);

      // 2 days overdue: not yet.
      await reminders.tick(at(10));
      expect(await escalations()).toEqual([]);
      // 3 days: the parent unit, once.
      await reminders.tick(at(11));
      await reminders.tick(at(12));
      expect(await escalations()).toEqual([['ESCALATE_PARENT', 'parentLead']]);
      // 7 days: the leadership, once; the one who holds the permission but may not read this record is not told.
      await reminders.tick(at(15));
      await reminders.tick(at(16));
      expect(await escalations()).toEqual([['ESCALATE_PARENT', 'parentLead'], ['ESCALATE_LEADERSHIP', 'boss']]);
      const told = await noticesOf(recordId);
      expect(told.filter((notice) => notice.to === 'parentLead')).toHaveLength(1);
      expect(told.filter((notice) => notice.to === 'boss')).toMatchObject([{ type: 'PETITION_OVERDUE', title: 'Bước xử lý quá hạn chưa được giải quyết' }]);
      expect(told.filter((notice) => notice.to === 'bossElsewhere')).toHaveLength(0);
    });

    it('a step whose flow sets no escalation never escalates, however late', async () => {
      const { recordId } = await work({ due: endOf(1) });
      await reminders.tick(at(20));
      expect((await rowsOf(recordId)).map((row) => row.kind)).toEqual(['BAND']);
    });
  });

  describe('the nudge', () => {
    it('tells the people who answer for the step now, with the message, and stays in the history of the step', async () => {
      const { recordId } = await work({ due: endOf(25), parties: [{}, { teamId: id.B, role: 'CHECK' }] });
      expect(await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', '  Please report by Friday  ', NOW)).toEqual({ notified: 1 });
      expect(await noticesOf(recordId)).toMatchObject([{ to: 'lead', type: 'SYSTEM', title: 'Đôn đốc xử lý', link: `/petitions/${recordId}?tab=phan-cong-xu-ly` }]);
      expect((await noticesOf(recordId))[0].message).toContain('Please report by Friday');
      expect(await scratch.db.procStepChange.findMany({ where: { recordId } })).toMatchObject([{ action: STEP_NUDGED, stepKey: 'k1', reason: 'Please report by Friday', actorId: id.actor, toValue: { notified: 1 } }]);

      // A second nudge is a second notice: it is never deduplicated away.
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', 'Again', NOW);
      expect(await noticesOf(recordId)).toHaveLength(2);
    });

    it('refuses an empty message, a step that is not being worked, an unknown step, and everything while the switch is off', async () => {
      const open = await work({ due: endOf(25) });
      const done = await work({ due: endOf(25), status: 'DONE' });
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'k1', '   ', NOW)).rejects.toMatchObject({ response: { code: 'STEP_REASON_REQUIRED' } });
      await expect(reminders.nudge(id.actor, 'PETITION', done.recordId, 'k1', 'Hurry', NOW)).rejects.toMatchObject({ response: { code: 'STEP_NOT_OPEN' } });
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'nope', 'Hurry', NOW)).rejects.toMatchObject({ response: { code: 'RECORD_STEP_NOT_FOUND' } });
      remindersOn = false;
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'k1', 'Hurry', NOW)).rejects.toMatchObject({ response: { code: 'RECORD_FLOW_NOT_FOUND' } });
      expect(await rowsOf(open.recordId)).toHaveLength(0);
      expect(await scratch.db.procStepChange.count({ where: { recordId: { in: [open.recordId, done.recordId] } } })).toBe(0);
    });
  });

  describe('a case (C13)', () => {
    it('the notice of a person who may read the case keeps the link to the assignment tab of the case form', async () => {
      const row = await scratch.db.case.create({ data: { name: `${tag} case`, caseCode: `${tag}-c1`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id.owner, assignedTeamId: id.O, status: 'DANG_DIEU_TRA' } as never });
      recordIds.push(row.id);
      await stepOn('CASE', row.id, { due: endOf(8), parties: [{ teamId: id.O, assigneeUserId: id.owner }] });
      await reminders.tick(NOW);
      expect(await rowsOf(row.id)).toMatchObject([{ status: 'DONE', outcome: 'SENT', recipientId: id.owner }]);
      expect(await noticesOf(row.id)).toMatchObject([{ to: 'owner', type: 'CASE_OVERDUE', link: `/cases/${row.id}/edit?tab=phan-cong-xu-ly`, metadata: { caseId: row.id } }]);
    });
  });
});
