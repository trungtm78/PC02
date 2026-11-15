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
import { ProcessingResultsService } from '../records/processing-results.service';
import { RecordStepAccessService } from '../records/record-step-access.service';
import type { PrismaClient } from '@prisma/client';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { CaseNotificationPolicyService } from '../../notifications/case-notification-policy.service';
import { NUDGE_COOLDOWN_MS, ProcessingReminderService, STEP_NUDGED } from './processing-reminder.service';

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
  // The switch of the records, as the cached flag service answers it: on.
  const flags = { isEnabled: () => Promise.resolve(true) } as never;
  /** What the two escalation settings say; a key that is absent = the row does not exist (the defaults apply). */
  let settings: Record<string, string> = {};
  const bell = jest.fn();
  const tag = `rem-${randomUUID().slice(0, 8)}`;
  /** Rows of `feature_flags` of this suite alone: the real switches are one row each for the whole shared database. */
  const SWITCH = `${tag}-reminders`;
  const RECORDS = `${tag}-records`;
  /** Flips the switch where every runner reads it: the row. */
  const switchTo = (enabled: boolean) => scratch.db.featureFlag.update({ where: { key: SWITCH }, data: { enabled } });

  /** The database with the two escalation settings answered by this suite (the rows are shared, so they are not written). */
  const withSettings = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) => {
              const { key } = args.where;
              if (key !== SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY && key !== SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY) return setting.findUnique(args as never);
              return Promise.resolve(key in settings ? { key, value: settings[key] } : null);
            };
          },
        });
      },
    });
  const id: Record<string, string> = {};
  const recordIds: string[] = [];
  let flowConfig = { flowId: '', versionId: '' };
  const stepConfig: Record<string, string> = {};
  let counter = 0;
  /** The clock of the step rule (`RecordStepAccessService`): the tests live in December, the wall clock does not. */
  let stepClock: Date = NOW;

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

  type Notifier = Pick<NotificationEventService, 'prepareInApp' | 'writeInApp' | 'ringBell'>;
  const service = (over: { notifier?: Notifier; gateway?: Pick<RecordGateway, 'canRead' | 'load'>; records?: string[] } = {}) => {
    const made = new ProcessingReminderService(withSettings(scratch.db) as never, flags, (over.gateway ?? gateway) as never, (over.notifier ?? events) as never);
    made.onlyRecordIds = over.records ?? recordIds;
    made.onlyUserIds = Object.values(id);
    made.switchKey = SWITCH;
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
    await person('delegate', officer.id);
    await db.user.update({ where: { id: id.member }, data: { firstName: 'An', lastName: 'Nguyen' } });

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
        { userId: id.delegate, teamId: id.T },
      ],
    });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.owner, updatedById: id.owner } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.owner } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    const base = { versionId: version.id, durationValue: 5, durationUnit: 'DAY' as const, anchor: 'RECEIVED' as const, ...T };
    // `plain` says nothing about escalation (the system settings decide); `escalating` says 4 and 6 days itself.
    stepConfig.plain = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k1', order: 0, name: `${tag} Verify` } })).id;
    stepConfig.escalating = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k2', order: 1, name: `${tag} Settle`, escalateAfterDays: 4, escalateLeadershipAfterDays: 6 } })).id;

    const prisma = db as never;
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, new AuditService(prisma), {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    stepAccess.now = () => stepClock;
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    await db.featureFlag.createMany({ data: [{ key: SWITCH, label: SWITCH, enabled: true }, { key: RECORDS, label: RECORDS, enabled: true }] });
    const casePolicy = new CaseNotificationPolicyService(prisma);
    casePolicy.recordsSwitchKey = RECORDS;
    events = new NotificationEventService(prisma, { notifyUser: bell } as never, {} as never, casePolicy);
    reminders = service();
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const people = Object.entries(id).filter(([name]) => name.length > 1).map(([, value]) => value);
    const flows = { flowId: flowConfig.flowId };
    await db.procReminder.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procDelegation.deleteMany({ where: { createdById: { in: people } } });
    await db.featureFlag.deleteMany({ where: { key: { in: [SWITCH, RECORDS] } } });
    await db.notification.deleteMany({ where: { userId: { in: people } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepOpinion.deleteMany({ where: { recordId: { in: recordIds } } });
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

  beforeEach(async () => {
    await switchTo(true);
    // No escalation unless a test says so: the tests of the bands count notices.
    settings = { [SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY]: '0', [SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY]: '0' };
    bell.mockClear();
    stepClock = NOW;
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
      expect(results.some((result) => result.planning === 'DONE')).toBe(true);
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
      expect((await reminders.plan(NOW)).planned).toBeGreaterThanOrEqual(1);
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
        notifier: {
          prepareInApp: (payload) => events.prepareInApp(payload),
          writeInApp: async (prepared, db) => {
            await events.writeInApp(prepared, db);
            throw new Error('the process died');
          },
          ringBell: () => undefined,
        },
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
      await switchTo(false);
      expect(await reminders.tick(NOW)).toEqual({ ran: false, planning: 'OFF', planned: 0, delivered: { sent: 0, dropped: 0, retried: 0, dead: 0 } });
      expect(await rowsOf(recordId)).toHaveLength(0);
      expect(await noticesOf(recordId)).toHaveLength(0);

      // The legacy scheduler asks the switch at run time which records to leave to these reminders.
      let on = false;
      const legacy = new DeadlineScheduler(scratch.db as never, {} as never, { isEnabled: () => Promise.resolve(on) } as never, { managedRecordIds: () => Promise.resolve([recordId]) } as never) as unknown as {
        managedExclusions(): Promise<Record<RecordKind, string[]> | null>;
      };
      expect(await legacy.managedExclusions()).toBeNull();
      on = true;
      expect(await legacy.managedExclusions()).toMatchObject({ PETITION: [recordId] });
    });

    it('on -> off -> on: what was decided waits while off, nothing new is decided, and back on only the CURRENT band speaks (the green one that waited is dropped)', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      await switchTo(false);
      expect(await reminders.deliver(NOW)).toEqual({ sent: 0, dropped: 0, retried: 0, dead: 0 });
      // The yellow band comes and goes while the switch is off.
      await reminders.tick(at(11));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', band: 'GREEN' }]);
      expect(await noticesOf(recordId)).toHaveLength(0);

      await switchTo(true);
      await reminders.tick(at(12));
      await reminders.tick(at(12, 5));
      expect((await rowsOf(recordId)).map((row) => [row.band, row.status, row.outcome])).toEqual([['GREEN', 'DONE', 'STALE'], ['RED', 'DONE', 'SENT']]);
      expect((await noticesOf(recordId)).map((notice) => notice.metadata.band)).toEqual(['RED']);
    });

    it('an overdue reminder of an earlier day is not sent a day late: the day it is delivered has its own', async () => {
      const { recordId } = await work({ due: endOf(8) });
      await reminders.plan(at(10));
      await reminders.tick(at(11));
      expect((await rowsOf(recordId)).map((row) => row.outcome)).toEqual(['STALE', 'SENT']);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });

    it('turned off in the ROW while a runner plans: that runner plans nothing more, though its flag cache still says on', async () => {
      const three = [await work({ due: endOf(13) }), await work({ due: endOf(13) }), await work({ due: endOf(13) })].map((made) => made.recordId);
      // The first question "may this person read" comes in the middle of the first batch: the switch goes off there.
      const flipping = service({
        records: three,
        gateway: {
          load: (kind, recordId) => gateway.load(kind, recordId),
          canRead: async (kind, recordId, user, options) => {
            await switchTo(false);
            return gateway.canRead(kind, recordId, user, options);
          },
        },
      });
      flipping.batchSize = 1;
      const result = await flipping.tick(NOW);
      expect(result).toMatchObject({ planning: 'PARTIAL', planned: 1, delivered: { sent: 0 } });
      expect(await scratch.db.procReminder.count({ where: { recordId: { in: three } } })).toBe(1);
      expect(await scratch.db.procReminder.count({ where: { recordId: { in: three }, status: 'PENDING' } })).toBe(1);
    });

    it('turned off in the ROW while a runner delivers: the notice being written is the last one', async () => {
      const three = [await work({ due: endOf(13) }), await work({ due: endOf(13) }), await work({ due: endOf(13) })].map((made) => made.recordId);
      const flipping = service({
        records: three,
        notifier: {
          prepareInApp: (payload) => events.prepareInApp(payload),
          writeInApp: async (prepared, db) => {
            await events.writeInApp(prepared, db);
            await switchTo(false);
          },
          ringBell: () => undefined,
        },
      });
      expect((await flipping.plan(NOW)).planned).toBe(3);
      expect(await flipping.deliver(NOW)).toMatchObject({ sent: 1 });
      expect(await scratch.db.procReminder.count({ where: { recordId: { in: three }, status: 'PENDING' } })).toBe(2);
    });
  });

  describe('a tick that cannot finish its planning', () => {
    it('plans as far as its budget goes and the next tick goes on from there: nothing is skipped, nothing twice', async () => {
      const three = [await work({ due: endOf(13) }), await work({ due: endOf(13) }), await work({ due: endOf(13) })].map((made) => made.recordId);
      const bounded = service({ records: three });
      bounded.batchSize = 1;
      bounded.stepBudget = 1;
      const count = () => scratch.db.procReminder.count({ where: { recordId: { in: three } } });

      expect(await bounded.tick(NOW)).toMatchObject({ planning: 'PARTIAL', planned: 1, delivered: { sent: 1 } });
      expect(await count()).toBe(1);
      expect(await bounded.tick(NOW)).toMatchObject({ planning: 'PARTIAL', planned: 1 });
      expect(await bounded.tick(NOW)).toMatchObject({ planning: 'PARTIAL', planned: 1 });
      expect(await count()).toBe(3);
      // The end of the scan: the next tick starts over and finds everything decided.
      expect(await bounded.tick(NOW)).toMatchObject({ planning: 'DONE', planned: 0 });
      expect(await bounded.tick(NOW)).toMatchObject({ planned: 0 });
      expect(await count()).toBe(3);
      for (const recordId of three) expect(await noticesOf(recordId)).toHaveLength(1);
    });

    it('planning that fails does not stop the delivery of what waits', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      const broken = service();
      broken.plan = () => Promise.reject(new Error('the scan failed'));
      expect(await broken.tick(NOW)).toMatchObject({ ran: true, planning: 'FAILED', planned: 0 });
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SENT' }]);
    });
  });

  describe('an error while asking who may read', () => {
    const failingGateway = (state: { fail: boolean }): Pick<RecordGateway, 'canRead' | 'load'> => ({
      load: (kind, recordId) => gateway.load(kind, recordId),
      canRead: (kind, recordId, user, options) => (state.fail ? Promise.reject(new Error('the database timed out')) : gateway.canRead(kind, recordId, user, options)),
    });

    it('when delivering: it is not a refusal. The row is retried and the person is told once it can be asked', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      const state = { fail: true };
      const shaky = service({ gateway: failingGateway(state) });
      expect(await shaky.deliver(NOW)).toMatchObject({ sent: 0, dropped: 0, retried: 1 });
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'PENDING', attempts: 1, outcome: null, lastError: 'the database timed out' }]);

      state.fail = false;
      await shaky.deliver(at(10, 5));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', attempts: 2 }]);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });

    it('when planning: nothing is written for that step, and the next tick plans it', async () => {
      const { recordId } = await work({ due: endOf(13) });
      const state = { fail: true };
      const shaky = service({ gateway: failingGateway(state), records: [recordId] });
      expect(await shaky.tick(NOW)).toMatchObject({ planning: 'DONE', planned: 0 });
      expect(await rowsOf(recordId)).toHaveLength(0);
      state.fail = false;
      await shaky.tick(NOW);
      expect(await noticesOf(recordId)).toHaveLength(1);
    });
  });

  describe('connections', () => {
    it('everything a notice needs is read BEFORE the transaction that writes it; inside it there is the write alone, on the transaction', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      const calls: string[] = [];
      let wroteOnRoot: boolean | null = null;
      const watching = service({
        records: [recordId],
        gateway: {
          load: (kind, id_) => gateway.load(kind, id_),
          canRead: (kind, id_, user, options) => {
            calls.push('canRead');
            return gateway.canRead(kind, id_, user, options);
          },
        },
        notifier: {
          prepareInApp: (payload) => {
            calls.push('prepare');
            return events.prepareInApp(payload);
          },
          writeInApp: (prepared, db) => {
            calls.push('write');
            wroteOnRoot = db === undefined || (db as unknown) === scratch.db;
            return events.writeInApp(prepared, db);
          },
          ringBell: () => calls.push('bell'),
        },
      });
      await watching.deliver(NOW);
      expect(calls).toEqual(['canRead', 'prepare', 'write', 'bell']);
      expect(wroteOnRoot).toBe(false);
    });

    it('a row claimed by a process that died is taken again when its lease runs out, and sent once', async () => {
      const { recordId } = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      // Claimed and abandoned.
      await scratch.db.procReminder.updateMany({ where: { recordId }, data: { attempts: 1, availableAt: new Date(NOW.getTime() + 300_000) } });
      await reminders.deliver(NOW);
      expect(await noticesOf(recordId)).toHaveLength(0);
      await reminders.deliver(at(10, 4));
      await reminders.deliver(at(10, 5));
      expect(await rowsOf(recordId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', attempts: 2 }]);
      expect(await noticesOf(recordId)).toHaveLength(1);
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

  describe('a delegate in force (R8)', () => {
    const delegation = (from: Date, to: Date, over: Record<string, unknown> = {}) =>
      scratch.db.procDelegation.create({ data: { fromUserId: id.member, toUserId: id.delegate, validFrom: from, validTo: to, createdById: id.owner, ...over } });
    /** A tick at an instant, with the step rule of the gateway on the same clock. */
    const tickAt = (when: Date) => {
      stepClock = when;
      return reminders.tick(when);
    };
    /** Held by another unit: the member reaches it by the step alone, the delegate by the step AND the delegation. */
    const named = (spec: StepSpec = {}) => work({ parties: [{ assigneeUserId: id.member }], ...spec }, { assignedTeamId: id.O });

    afterEach(async () => {
      await scratch.db.procDelegation.deleteMany({ where: { createdById: id.owner } });
    });

    it('gets one reminder per band alongside the person they act for, in words that say for whom', async () => {
      await delegation(at(9), endOf(20));
      const { recordId } = await named({ due: endOf(13) });
      await tickAt(NOW);
      await tickAt(at(10, 9));
      expect(await toWhom(recordId)).toEqual(['delegate', 'member']);
      await tickAt(at(11));
      await tickAt(at(11, 5));
      expect(await toWhom(recordId)).toEqual(['delegate', 'delegate', 'member', 'member']);

      const notices = await noticesOf(recordId);
      const mine = notices.filter((notice) => notice.to === 'delegate');
      expect(mine.map((notice) => notice.metadata.band)).toEqual(['GREEN', 'YELLOW']);
      expect(mine[0].message).toContain('Nguyen An');
      expect(mine[0].message).toContain('uỷ quyền');
      expect(mine[0].metadata).toMatchObject({ onBehalfOfUserId: id.member });
      for (const notice of notices.filter((row) => row.to === 'member')) expect(notice.message).not.toContain('uỷ quyền');
    });

    it('gets none before the period and none after it', async () => {
      await delegation(at(11, 0), at(11, 12));
      const { recordId } = await named({ due: endOf(13) });
      await tickAt(NOW);
      expect(await toWhom(recordId)).toEqual(['member']);
      await tickAt(at(11));
      expect(await toWhom(recordId)).toEqual(['delegate', 'member', 'member']);
      await tickAt(at(12));
      expect(await toWhom(recordId)).toEqual(['delegate', 'member', 'member', 'member']);
    });

    it('gets none after a revoke', async () => {
      await delegation(at(9), endOf(20), { revokedAt: at(9, 5), revokedById: id.owner });
      const { recordId } = await named();
      await tickAt(NOW);
      expect(await toWhom(recordId)).toEqual(['member']);
      expect(await rowsOf(recordId)).toHaveLength(1);
    });

    it('a delegation that ends between planning and delivery: the row of the delegate ends STALE, unsent; the person they acted for is still told', async () => {
      const row = await delegation(at(9), endOf(20));
      const { recordId } = await named();
      stepClock = NOW;
      await reminders.plan(NOW);
      expect(await rowsOf(recordId)).toHaveLength(2);
      await scratch.db.procDelegation.update({ where: { id: row.id }, data: { revokedAt: NOW, revokedById: id.owner } });
      await reminders.deliver(NOW);
      const rows = await rowsOf(recordId);
      expect(rows.filter((reminder) => reminder.recipientId === id.delegate)).toMatchObject([{ status: 'DONE', outcome: 'STALE' }]);
      expect(rows.filter((reminder) => reminder.recipientId === id.member)).toMatchObject([{ status: 'DONE', outcome: 'SENT' }]);
      expect(await toWhom(recordId)).toEqual(['member']);
    });

    it('a delegate who is ALSO a recipient in their own right gets one reminder, in their own name', async () => {
      await delegation(at(9), endOf(20));
      const { recordId } = await named({ parties: [{ assigneeUserId: id.member }, { role: 'CHECK', assigneeUserId: id.delegate }] });
      await tickAt(NOW);
      await tickAt(at(10, 9));
      expect(await toWhom(recordId)).toEqual(['delegate', 'member']);
      expect(await rowsOf(recordId)).toHaveLength(2);
      const [own] = (await noticesOf(recordId)).filter((notice) => notice.to === 'delegate');
      expect(own.message).not.toContain('uỷ quyền');
      expect(own.metadata.onBehalfOfUserId).toBeUndefined();
    });

    it('a delegate who no longer shares an active unit with the person gets nothing', async () => {
      await delegation(at(9), endOf(20));
      const { recordId } = await named();
      await scratch.db.userTeam.deleteMany({ where: { userId: id.delegate, teamId: id.T } });
      try {
        await tickAt(NOW);
        expect(await toWhom(recordId)).toEqual(['member']);
        expect(await rowsOf(recordId)).toHaveLength(1);
      } finally {
        await scratch.db.userTeam.create({ data: { userId: id.delegate, teamId: id.T } });
      }
    });

    it('a nudge tells the delegate of a person who answers for the step as well; one revoked before the delivery is not told', async () => {
      const row = await delegation(at(9), endOf(20));
      const told = await named({ due: endOf(25) });
      stepClock = NOW;
      expect(await reminders.nudge(id.actor, 'PETITION', told.recordId, 'k1', { message: 'Please report' }, NOW)).toEqual({ notified: 2 });
      const notices = await noticesOf(told.recordId);
      expect(notices.map((notice) => notice.to).sort()).toEqual(['delegate', 'member']);
      expect(notices.find((notice) => notice.to === 'delegate')?.message).toContain('Nguyen An');

      // The delegate is the one who nudges: they are not told about their own nudge.
      const own = await named({ due: endOf(25) });
      expect(await reminders.nudge(id.delegate, 'PETITION', own.recordId, 'k1', { message: 'Please report' }, NOW)).toEqual({ notified: 1 });
      expect(await toWhom(own.recordId)).toEqual(['member']);

      await scratch.db.procDelegation.update({ where: { id: row.id }, data: { revokedAt: NOW, revokedById: id.owner } });
      const after = await named({ due: endOf(25) });
      expect(await reminders.nudge(id.actor, 'PETITION', after.recordId, 'k1', { message: 'Please report' }, NOW)).toEqual({ notified: 1 });
      expect(await toWhom(after.recordId)).toEqual(['member']);
    });
  });

  describe('escalation', () => {
    const escalationsOf = async (recordId: string) => (await rowsOf(recordId)).filter((row) => row.kind !== 'BAND').map((row) => [row.kind, Object.keys(id).find((name) => id[name] === row.recipientId)]);

    it('a step whose flow says nothing: the system defaults, 3 days for the parent unit and 7 for the leadership, each once, each only if they may read', async () => {
      // No rows at all: the defaults.
      settings = {};
      const { recordId } = await work({ due: endOf(8) });

      // 2 days overdue: not yet.
      await reminders.tick(at(10));
      expect(await escalationsOf(recordId)).toEqual([]);
      // 3 days: the parent unit, once.
      await reminders.tick(at(11));
      await reminders.tick(at(12));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead']]);
      // 7 days: the leadership, once; the one who holds the permission but may not read this record is not told.
      await reminders.tick(at(15));
      await reminders.tick(at(16));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead'], ['ESCALATE_LEADERSHIP', 'boss']]);
      const told = await noticesOf(recordId);
      expect(told.filter((notice) => notice.to === 'parentLead')).toHaveLength(1);
      expect(told.filter((notice) => notice.to === 'boss')).toMatchObject([{ type: 'PETITION_OVERDUE', title: 'Bước xử lý quá hạn chưa được giải quyết' }]);
      expect(told.filter((notice) => notice.to === 'bossElsewhere')).toHaveLength(0);
    });

    it('the settings are what the defaults stand in for: other numbers move the days', async () => {
      settings = { [SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY]: '1', [SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY]: '2' };
      const { recordId } = await work({ due: endOf(8) });
      await reminders.tick(at(9));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead']]);
      await reminders.tick(at(10));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead'], ['ESCALATE_LEADERSHIP', 'boss']]);
    });

    it('a step that says its own days (4 and 6) is not moved by the settings', async () => {
      settings = { [SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY]: '1', [SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY]: '2' };
      const { recordId } = await work({ due: endOf(8), config: 'escalating' });
      // 3 days overdue: the settings would have told both long ago.
      await reminders.tick(at(11));
      expect(await escalationsOf(recordId)).toEqual([]);
      await reminders.tick(at(12));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead']]);
      await reminders.tick(at(13));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead']]);
      await reminders.tick(at(14));
      expect(await escalationsOf(recordId)).toEqual([['ESCALATE_PARENT', 'parentLead'], ['ESCALATE_LEADERSHIP', 'boss']]);
    });

    it.each([['0'], ['']])('a setting of "%s" switches the escalation off, however late the step is', async (value) => {
      settings = { [SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY]: value, [SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY]: value };
      const { recordId } = await work({ due: endOf(1) });
      await reminders.tick(at(20));
      expect((await rowsOf(recordId)).map((row) => row.kind)).toEqual(['BAND']);
    });
  });

  describe('the nudge', () => {
    const changesOf = (recordId: string) => scratch.db.procStepChange.findMany({ where: { recordId }, orderBy: { at: 'asc' } });
    const later = (ms: number) => new Date(NOW.getTime() + ms);

    it('tells the people who answer for the step now, with the message, and stays in the history of the step', async () => {
      const { recordId } = await work({ due: endOf(25), parties: [{}, { teamId: id.B, role: 'CHECK' }] });
      expect(await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: '  Please report by Friday  ' }, NOW)).toEqual({ notified: 1 });
      expect(await noticesOf(recordId)).toMatchObject([{ to: 'lead', type: 'SYSTEM', title: 'Đôn đốc xử lý', link: `/petitions/${recordId}?tab=phan-cong-xu-ly` }]);
      expect((await noticesOf(recordId))[0].message).toContain('Please report by Friday');
      expect(await changesOf(recordId)).toMatchObject([{ action: STEP_NUDGED, stepKey: 'k1', reason: 'Please report by Friday', actorId: id.actor, toValue: { notified: 1 } }]);
    });

    it('is written into the opinion book of the step (R4): the results of the step list it, with the message, who and when; a refused nudge and a replayed one add none', async () => {
      const { recordId } = await work({ due: endOf(25) });
      // The reader of `GET .../steps/:stepKey/results`: it only reads.
      const book = async () => (await new ProcessingResultsService(scratch.db as never, {} as never).results('PETITION', recordId, 'k1')).opinions;
      const input = { message: ' Report by Friday ', idempotencyKey: `nudge-${randomUUID()}` };
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', input, NOW);
      expect(await book()).toMatchObject([
        { kind: 'NUDGE', verdict: 'NOTE', content: 'Report by Friday', authorId: id.actor, authorTeamId: null, reportId: null, reportRevision: null, withdrawnAt: null, createdAt: NOW.toISOString() },
      ]);

      // The same request again: the first answer, nothing written.
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', input, later(5_000));
      // Another one inside the window: refused, nothing written.
      await expect(reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Second' }, later(60_000))).rejects.toMatchObject({ response: { code: 'NUDGE_TOO_SOON' } });
      expect(await book()).toHaveLength(1);

      // After the window: a second entry, after the first.
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Second' }, later(NUDGE_COOLDOWN_MS + 60_000));
      expect((await book()).map((opinion) => [opinion.kind, opinion.content])).toEqual([['NUDGE', 'Report by Friday'], ['NUDGE', 'Second']]);
    });

    it('once per person and step per 30 minutes: a second one is refused with a code and adds nothing; after the window, and for another person, it goes through', async () => {
      const { recordId } = await work({ due: endOf(25) });
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'First' }, NOW);
      await expect(reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Second' }, later(60_000))).rejects.toMatchObject({ status: 429, response: { code: 'NUDGE_TOO_SOON' } });
      // 29 minutes later is another fixed window of the key for some instants; it is still too soon.
      await expect(reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Third' }, later(NUDGE_COOLDOWN_MS - 60_000))).rejects.toMatchObject({ response: { code: 'NUDGE_TOO_SOON' } });
      expect(await noticesOf(recordId)).toHaveLength(1);
      expect(await changesOf(recordId)).toHaveLength(1);

      // Another person is not held back by the first one's nudge.
      await reminders.nudge(id.boss, 'PETITION', recordId, 'k1', { message: 'From the boss' }, later(60_000));
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Again' }, later(NUDGE_COOLDOWN_MS + 60_000));
      expect((await noticesOf(recordId)).map((notice) => notice.message.split(': ')[1])).toEqual(['First', 'From the boss', 'Again']);
      expect(await changesOf(recordId)).toHaveLength(3);
    });

    it('two requests at the same instant: exactly one passes (the unique key decides, not a look before)', async () => {
      const { recordId } = await work({ due: endOf(25) });
      const results = await Promise.allSettled([1, 2, 3, 4].map((n) => service().nudge(id.actor, 'PETITION', recordId, 'k1', { message: `Hurry ${n}` }, NOW)));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      for (const result of results) {
        if (result.status === 'rejected') expect(result.reason).toMatchObject({ response: { code: 'NUDGE_TOO_SOON' } });
      }
      expect(await noticesOf(recordId)).toHaveLength(1);
      expect(await changesOf(recordId)).toHaveLength(1);
    });

    it('the same request sent again with its idempotency key gets the first answer and does nothing, also when both arrive together', async () => {
      const { recordId } = await work({ due: endOf(25) });
      const input = { message: 'Hurry', idempotencyKey: `nudge-${randomUUID()}` };
      expect(await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', input, NOW)).toEqual({ notified: 1 });
      expect(await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', input, later(5_000))).toEqual({ notified: 1 });

      const other = await work({ due: endOf(25) });
      const together = { message: 'Hurry', idempotencyKey: `nudge-${randomUUID()}` };
      const answers = await Promise.all([1, 2, 3].map(() => service().nudge(id.actor, 'PETITION', other.recordId, 'k1', together, NOW)));
      expect(answers).toEqual([{ notified: 1 }, { notified: 1 }, { notified: 1 }]);

      for (const each of [recordId, other.recordId]) {
        expect(await noticesOf(each)).toHaveLength(1);
        expect(await changesOf(each)).toHaveLength(1);
      }
      await expect(reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Hurry', idempotencyKey: 'short' }, NOW)).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_INVALID' } });
    });

    it('delivers its own notices and leaves the reminders that wait to the tick', async () => {
      const waiting = await work({ due: endOf(13) });
      await reminders.plan(NOW);
      const { recordId } = await work({ due: endOf(25) });
      await reminders.nudge(id.actor, 'PETITION', recordId, 'k1', { message: 'Hurry' }, NOW);
      expect(await noticesOf(recordId)).toHaveLength(1);
      expect(await rowsOf(waiting.recordId)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);
      await reminders.deliver(NOW);
    });

    it('refuses an empty message, a step that is not being worked, an unknown step, and everything while the switch is off', async () => {
      const open = await work({ due: endOf(25) });
      const done = await work({ due: endOf(25), status: 'DONE' });
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'k1', { message: '   ' }, NOW)).rejects.toMatchObject({ response: { code: 'STEP_REASON_REQUIRED' } });
      await expect(reminders.nudge(id.actor, 'PETITION', done.recordId, 'k1', { message: 'Hurry' }, NOW)).rejects.toMatchObject({ response: { code: 'STEP_NOT_OPEN' } });
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'nope', { message: 'Hurry' }, NOW)).rejects.toMatchObject({ response: { code: 'RECORD_STEP_NOT_FOUND' } });
      await switchTo(false);
      await expect(reminders.nudge(id.actor, 'PETITION', open.recordId, 'k1', { message: 'Hurry' }, NOW)).rejects.toMatchObject({ response: { code: 'RECORD_FLOW_NOT_FOUND' } });
      expect(await rowsOf(open.recordId)).toHaveLength(0);
      expect(await scratch.db.procStepChange.count({ where: { recordId: { in: [open.recordId, done.recordId] } } })).toBe(0);
      expect(await scratch.db.procStepOpinion.count({ where: { recordId: { in: [open.recordId, done.recordId] } } })).toBe(0);
    });
  });

  describe('a case (C13)', () => {
    const caseOf = async (over: Record<string, unknown> = {}): Promise<string> => {
      const row = await scratch.db.case.create({ data: { name: `${tag} case ${++counter}`, caseCode: `${tag}-c${counter}`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id.owner, assignedTeamId: id.O, status: 'DANG_DIEU_TRA', ...over } as never });
      recordIds.push(row.id);
      return row.id;
    };

    it('the notice of a person who may read the case keeps the link to the assignment tab of the case form', async () => {
      const caseId = await caseOf();
      await stepOn('CASE', caseId, { due: endOf(8), parties: [{ teamId: id.O, assigneeUserId: id.owner }] });
      await reminders.tick(NOW);
      expect(await rowsOf(caseId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', recipientId: id.owner }]);
      expect(await noticesOf(caseId)).toMatchObject([{ to: 'owner', type: 'CASE_OVERDUE', link: `/cases/${caseId}/edit?tab=phan-cong-xu-ly`, metadata: { caseId } }]);
    });

    it('a person outside the unit of the case, named by the step alone, is told too: the link to the tab, and nothing of the case', async () => {
      // Held by O; the step is worked by T, whose head is not in the scope of the case.
      const caseId = await caseOf();
      await stepOn('CASE', caseId, { due: endOf(8), parties: [{ teamId: id.T }] });
      expect(await gateway.canRead('CASE', caseId, { id: id.lead, role: `${tag}-officer`, canDispatch: false })).toBe(false);
      await reminders.tick(NOW);
      expect(await rowsOf(caseId)).toMatchObject([{ status: 'DONE', outcome: 'SENT', recipientId: id.lead }]);
      const [notice] = await noticesOf(caseId);
      expect(notice).toMatchObject({ to: 'lead', link: `/cases/${caseId}/edit?tab=phan-cong-xu-ly`, title: 'Cập nhật hồ sơ', message: 'Hồ sơ có cập nhật', metadata: { caseId } });
      expect(JSON.stringify(notice)).not.toContain(`${tag}-c`);
    });

    it('the step lifts the scope only for a notice that points at the tab of THAT case, and only while the step is being worked', async () => {
      const caseId = await caseOf();
      const stepId = await stepOn('CASE', caseId, { due: endOf(8), parties: [{ teamId: id.T }] });
      const notice = { toUserId: id.lead, type: 'CASE_OVERDUE' as const, title: 't', message: 'm', link: `/cases/${caseId}/edit?tab=phan-cong-xu-ly`, metadata: { caseId } };
      expect(await events.prepareInApp(notice)).not.toBeNull();
      // Any other notice about the case: as before, nothing.
      expect(await events.prepareInApp({ ...notice, link: `/cases/${caseId}` })).toBeNull();
      // The step is done: the reason is gone.
      await scratch.db.procRecordStep.update({ where: { id: stepId }, data: { status: 'DONE', doneAt: NOW } });
      expect(await events.prepareInApp(notice)).toBeNull();
    });

    it('a RESTRICTED case: the step never lifts the sensitivity rule. Nothing is decided, and the policy itself lets nothing through', async () => {
      const caseId = await caseOf({ sensitivity: 'RESTRICTED' });
      await stepOn('CASE', caseId, { due: endOf(8), parties: [{ teamId: id.T }] });
      await reminders.tick(NOW);
      expect(await rowsOf(caseId)).toHaveLength(0);
      // Asked directly, as a delivery (or the list of the bell) would ask it.
      const notice = { toUserId: id.lead, type: 'CASE_OVERDUE' as const, title: 't', message: 'm', link: `/cases/${caseId}/edit?tab=phan-cong-xu-ly`, metadata: { caseId } };
      expect(await events.prepareInApp(notice)).toBeNull();
      expect(await scratch.db.notification.count({ where: { userId: id.lead, metadata: { path: ['caseId'], equals: caseId } } })).toBe(0);
    });
  });
});
