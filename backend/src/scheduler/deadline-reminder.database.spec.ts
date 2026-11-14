import { randomUUID } from 'node:crypto';
import { CaseStatus, IncidentStatus, PetitionStatus, type PrismaClient } from '@prisma/client';
import { addDays, endOfDay, startOfDay, subDays, subHours } from 'date-fns';
import { setEnforcement } from '../authz/enforcement';
import { TRANG_THAI_KET_THUC } from '../common/trang-thai/trang-thai-ket-thuc';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../common/testing/shared-row-turn';
import { PushService } from '../push/push.service';
import { DeadlineScheduler } from './deadline.scheduler';

/**
 * REGRESSION CONTRACT: the daily deadline reminder as it works TODAY, on a real PostgreSQL. Records without a
 * processing flow must keep being reminded exactly like this once flows send reminders of their own.
 *
 * These tests state what the code does, including what looks odd; they do not say it is right.
 *
 * The scheduler, the push service and every query are the real thing. Two arrangements keep the suite to itself in a
 * database every suite shares:
 *  - the scheduler scans ALL cases, incidents and petitions of the database. Here its three scans go through a client
 *    that adds "and the record is one of this suite's" to the query, so that it never notifies about (or fails on)
 *    the rows of a suite running beside it. The query itself runs unchanged on PostgreSQL;
 *  - the warning threshold is one row for the whole database (`system_settings.CANH_BAO_SAP_HAN`). The suite takes
 *    its turn on it, sets it, and puts back what was there. The same for the role named ADMIN, which it creates only
 *    when the database has none.
 *
 * The scheduler reads the clock itself (`new Date()`) and has no way to be handed one. So the clock of the process is
 * held still for the whole suite: `Date` alone is replaced (every timer stays real, the database driver needs them),
 * and the fixtures and every run of the scheduler see the same instant. The instant is 30 seconds before midnight on
 * the last day of a month, where "today", "in 3 days" and "overdue" are easiest to get wrong; a run that started
 * just before midnight and finished after it used to change what the fixtures meant.
 * `DEADLINE_REMINDER_SPEC_NOW` (an ISO instant) holds the clock elsewhere. It must not be later than the real time:
 * a row the database stamps itself (`notifiedAt DEFAULT now()`) would then look older than the frozen clock allows.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

/** 31 October 2026, 23:59:30 in the time zone of the process (the scheduler counts days in that zone). */
const FROZEN_NOW = process.env.DEADLINE_REMINDER_SPEC_NOW ? new Date(process.env.DEADLINE_REMINDER_SPEC_NOW) : new Date(2026, 9, 31, 23, 59, 30);
/** Everything jest can replace except `Date`: timers, ticks and the performance clock stay real. */
const STAY_REAL = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

const WARNING_KEY = 'CANH_BAO_SAP_HAN';
/** Not the default (7): a record 6 days ahead tells the two apart. */
const WARNING_DAYS = 5;

/** The statuses the scheduler itself treats as finished: a record in one of them is never reminded. */
const SILENT = {
  case: [CaseStatus.DINH_CHI, CaseStatus.TAM_DINH_CHI, CaseStatus.DA_LUU_TRU, CaseStatus.DA_KET_LUAN] as string[],
  incident: [
    IncidentStatus.TAM_DINH_CHI,
    IncidentStatus.DA_GIAI_QUYET,
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.CHUYEN_XPHC,
    IncidentStatus.TDC_HET_THOI_HIEU,
    IncidentStatus.TDC_HTH_KHONG_KT,
    IncidentStatus.PHUC_HOI_NGUON_TIN,
    IncidentStatus.DA_CHUYEN_DON_VI,
    IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.PHAN_LOAI_DAN_SU,
  ] as string[],
  petition: [PetitionStatus.DA_GIAI_QUYET, PetitionStatus.DA_CHUYEN_VU_VIEC, PetitionStatus.DA_CHUYEN_VU_AN] as string[],
};

run('the daily deadline reminder, on PostgreSQL', () => {
  jest.setTimeout(120_000);
  let scratch: ScratchDatabase;
  let scheduler: DeadlineScheduler;
  const tag = `drm-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let previousWarning: { value: string } | null = null;
  let createdAdminRole = false;
  let n = 0;

  /** The real client; the three scans of the scheduler see this suite's records only. */
  const onlyOwnRecords = (client: PrismaClient): PrismaClient => {
    const own = { case: { name: { startsWith: tag } }, incident: { name: { startsWith: tag } }, petition: { senderName: { startsWith: tag } } };
    return new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'case' && property !== 'incident' && property !== 'petition') return Reflect.get(target, property, receiver) as unknown;
        const model = target[property] as unknown as { findMany: (args: { where?: object }) => Promise<unknown> };
        return new Proxy(model, {
          get(inner, method, innerReceiver) {
            if (method !== 'findMany') return Reflect.get(inner, method, innerReceiver) as unknown;
            return (args: { where?: object }) => inner.findMany({ ...args, where: { AND: [args.where ?? {}, own[property]] } });
          },
        });
      },
    });
  };

  const incident = (name: string, data: Record<string, unknown>) => {
    n += 1;
    return scratch.db.incident.create({ data: { code: `${tag}-${n}`, name: `${tag} ${name}`, ...data } as never });
  };
  const aCase = (name: string, data: Record<string, unknown>) =>
    scratch.db.case.create({ data: { name: `${tag} ${name}`, caseProvenance: 'DIRECT_DISCOVERY', ...data } as never });
  const petition = (name: string, data: Record<string, unknown>) => {
    n += 1;
    return scratch.db.petition.create({
      data: { stt: `${tag}-${n}`, receivedDate: new Date('2026-01-05T00:00:00Z'), senderName: `${tag} ${name}`, ...data } as never,
    });
  };

  const people = () => Object.entries(id).filter(([key]) => key.startsWith('u_')).map(([, value]) => value);
  const nameOf = (userId: string) => Object.keys(id).find((key) => id[key] === userId)!.slice(2);
  /** Every notification this suite's people have, as `TYPE who`, for one record (matched by its link). */
  const noticesFor = async (link: string) =>
    (await scratch.db.notification.findMany({ where: { userId: { in: people() }, link } })).map((x) => `${x.type} ${nameOf(x.userId)}`).sort();
  const noticesOf = (who: string) => scratch.db.notification.findMany({ where: { userId: id[`u_${who}`] } });
  const forget = () => scratch.db.notification.deleteMany({ where: { userId: { in: people() } } });
  const forgetDedupe = () => scratch.db.overdueNotification.deleteMany({ where: { userId: { in: people() } } });
  const setWarning = (value: string) =>
    scratch.db.systemSetting.upsert({ where: { key: WARNING_KEY }, update: { value }, create: { key: WARNING_KEY, value, label: `${tag} spec` } });

  beforeAll(async () => {
    if (Number.isNaN(FROZEN_NOW.getTime())) throw new Error('DEADLINE_REMINDER_SPEC_NOW is not an ISO instant');
    jest.useFakeTimers({ doNotFake: [...STAY_REAL], now: FROZEN_NOW });
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    await takeTurnOnSharedRow(scratch.pg, 'deadline-warning-days');
    previousWarning = await db.systemSetting.findUnique({ where: { key: WARNING_KEY }, select: { value: true } });
    await setWarning(String(WARNING_DAYS));
    // Permissions by team are not enforced in this suite: recipients are chosen by team membership and grants.
    setEnforcement(null);

    const officer = await db.role.create({ data: { name: `${tag}-officer` } });
    // "Is an administrator" goes by the name of the role, and a name exists once: created here only if absent.
    await takeTurnOnSharedRow(scratch.pg, 'admin-role');
    let admin = await db.role.findUnique({ where: { name: ROLE_NAMES.ADMIN } });
    if (!admin) {
      admin = await db.role.create({ data: { name: ROLE_NAMES.ADMIN } });
      createdAdminRole = true;
    }
    const user = async (name: string, over: Record<string, unknown> = {}) => {
      id[`u_${name}`] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: officer.id, ...over } as never })).id;
    };
    await user('investigator');
    await user('member');
    await user('grantee');
    await user('expiredGrantee');
    await user('inactiveMember', { isActive: false });
    await user('adminMember', { roleId: admin.id });
    await user('adminInvestigator', { roleId: admin.id });
    await user('inactiveInvestigator', { isActive: false });
    await user('outsider');
    await user('enteredBy');
    await user('assignee');
    await user('statusOwner');
    await user('loner');

    id.team = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ` } })).id;
    id.otherTeam = (await db.team.create({ data: { code: `${tag}-U`, name: `${tag} Tổ khác` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.u_member, teamId: id.team },
        { userId: id.u_inactiveMember, teamId: id.team },
        { userId: id.u_adminMember, teamId: id.team },
        { userId: id.u_outsider, teamId: id.otherTeam },
      ],
    });
    await db.dataAccessGrant.createMany({
      data: [
        { granteeId: id.u_grantee, teamId: id.team, accessLevel: 'READ', grantedById: id.u_member },
        { granteeId: id.u_expiredGrantee, teamId: id.team, accessLevel: 'READ', grantedById: id.u_member, expiresAt: subDays(new Date(), 1) },
      ],
    });

    scheduler = new DeadlineScheduler(onlyOwnRecords(db) as never, new PushService(db as never));
  });

  afterAll(async () => {
    const { db } = scratch;
    await db.notification.deleteMany({ where: { userId: { in: people() } } });
    await db.overdueNotification.deleteMany({ where: { userId: { in: people() } } });
    await db.incident.deleteMany({ where: { name: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.petition.deleteMany({ where: { senderName: { startsWith: tag } } });
    await db.dataAccessGrant.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: `${tag}-officer` } });
    if (createdAdminRole) await db.role.deleteMany({ where: { name: ROLE_NAMES.ADMIN } });
    if (previousWarning) await setWarning(previousWarning.value);
    else await db.systemSetting.deleteMany({ where: { key: WARNING_KEY } });
    setEnforcement(null);
    await scratch.close();
    jest.useRealTimers();
  });

  describe('one run over records of every kind', () => {
    const record: Record<string, { id: string }> = {};
    const link = (kind: 'incidents' | 'cases' | 'petitions', key: string) => `/${kind}/${record[key].id}`;

    beforeAll(async () => {
      const now = new Date();
      const open = { investigatorId: id.u_investigator, assignedTeamId: id.team };
      const noonIn = (days: number) => addDays(startOfDay(now), days).getTime() + 12 * 3_600_000;

      record.overdue = await incident('quá hạn', { ...open, status: 'DANG_XAC_MINH', deadline: subDays(now, 2) });
      record.earlierToday = await incident('sớm hơn hôm nay', { investigatorId: id.u_loner, status: 'DANG_XAC_MINH', deadline: new Date(now.getTime() - 1000) });
      record.laterToday = await incident('cuối hôm nay', { investigatorId: id.u_loner, status: 'DANG_XAC_MINH', deadline: endOfDay(now) });
      record.inThree = await incident('còn ba ngày', { ...open, status: 'DANG_XAC_MINH', deadline: new Date(noonIn(3)) });
      record.inSix = await incident('còn sáu ngày', { ...open, status: 'DANG_XAC_MINH', deadline: new Date(noonIn(6)) });
      record.noDeadline = await incident('không hạn', { ...open, status: 'DANG_XAC_MINH' });
      record.deleted = await incident('đã xoá', { ...open, status: 'DANG_XAC_MINH', deadline: subDays(now, 2), deletedAt: now });
      record.nobody = await incident('không ai giữ', { status: 'DANG_XAC_MINH', deadline: subDays(now, 2) });
      record.teamOnly = await incident('chỉ có tổ', { assignedTeamId: id.team, status: 'TIEP_NHAN', deadline: subDays(now, 2) });
      record.investigatorOnly = await incident('chỉ có điều tra viên', { investigatorId: id.u_loner, status: 'TIEP_NHAN', deadline: subDays(now, 2) });
      record.adminInvestigator = await incident('điều tra viên là admin', { investigatorId: id.u_adminInvestigator, status: 'TIEP_NHAN', deadline: subDays(now, 2) });
      record.inactiveInvestigator = await incident('điều tra viên đã khoá', { investigatorId: id.u_inactiveInvestigator, status: 'TIEP_NHAN', deadline: subDays(now, 2) });

      record.caseOverdue = await aCase('án quá hạn', { ...open, status: 'DANG_DIEU_TRA', deadline: subDays(now, 2) });
      record.caseInThree = await aCase('án còn ba ngày', { ...open, status: 'DANG_DIEU_TRA', deadline: new Date(noonIn(3)) });

      const entered = { enteredById: id.u_enteredBy, assignedToId: id.u_assignee, assignedTeamId: id.team };
      record.petitionOverdue = await petition('đơn quá hạn', { ...entered, status: 'DANG_XU_LY', deadline: subDays(now, 2) });
      record.petitionInThree = await petition('đơn còn ba ngày', { ...entered, status: 'DANG_XU_LY', deadline: new Date(noonIn(3)) });
      record.petitionAssigneeOnly = await petition('đơn chỉ có người được giao', { assignedToId: id.u_assignee, status: 'DANG_XU_LY', deadline: subDays(now, 2) });

      // One overdue record per status of each kind, all owned by the same person.
      for (const status of Object.values(IncidentStatus)) await incident(`trạng thái ${status}`, { investigatorId: id.u_statusOwner, status, deadline: subDays(now, 3) });
      for (const status of Object.values(CaseStatus)) await aCase(`trạng thái ${status}`, { investigatorId: id.u_statusOwner, status, deadline: subDays(now, 3) });
      for (const status of Object.values(PetitionStatus)) await petition(`trạng thái ${status}`, { enteredById: id.u_statusOwner, status, deadline: subDays(now, 3) });

      await scheduler.checkDeadlines();
    });

    it('the clock stood still from the first fixture to the end of the run', () => {
      expect(new Date().getTime()).toBe(FROZEN_NOW.getTime());
      expect(Date.now()).toBe(FROZEN_NOW.getTime());
    });

    describe('which records are picked', () => {
      it('an open incident whose deadline has passed is reported overdue', async () => {
        expect(await noticesFor(link('incidents', 'overdue'))).toContain('INCIDENT_OVERDUE investigator');
      });

      it('a deadline earlier today is already overdue: the comparison is by the instant, not by the day', async () => {
        expect(await noticesFor(link('incidents', 'earlierToday'))).toEqual(['INCIDENT_OVERDUE loner']);
      });

      it('a deadline later today is "near", worded "hôm nay"', async () => {
        const [notice] = await scratch.db.notification.findMany({ where: { link: link('incidents', 'laterToday') } });
        expect(notice.type).toBe('INCIDENT_DEADLINE_NEAR');
        expect(notice.message).toBe(`${tag} cuối hôm nay — hôm nay đến hạn xử lý`);
      });

      it('a deadline within the warning threshold is reported near, with the days left', async () => {
        const notices = await scratch.db.notification.findMany({ where: { link: link('incidents', 'inThree'), userId: id.u_investigator } });
        expect(notices.map((x) => x.type)).toEqual(['INCIDENT_DEADLINE_NEAR']);
        expect(notices[0].message).toBe(`${tag} còn ba ngày — còn 3 ngày đến hạn xử lý`);
      });

      it('the threshold is the setting CANH_BAO_SAP_HAN (here 5 days): a deadline 6 days ahead is not reported', async () => {
        expect(await noticesFor(link('incidents', 'inSix'))).toEqual([]);
      });

      it('a record without a deadline is never reported', async () => {
        expect(await noticesFor(link('incidents', 'noDeadline'))).toEqual([]);
      });

      it('a deleted record is never reported', async () => {
        expect(await noticesFor(link('incidents', 'deleted'))).toEqual([]);
      });

      it('a record held by nobody (no investigator, no team) is never reported', async () => {
        expect(await noticesFor(link('incidents', 'nobody'))).toEqual([]);
      });

      it('an overdue record is not reported near as well', async () => {
        expect((await noticesFor(link('incidents', 'overdue'))).filter((x) => x.startsWith('INCIDENT_DEADLINE_NEAR'))).toEqual([]);
      });
    });

    describe('who is told', () => {
      it('the investigator, the active members of the assigned team and the holders of a grant on it that has not expired', async () => {
        expect(await noticesFor(link('incidents', 'overdue'))).toEqual(['INCIDENT_OVERDUE grantee', 'INCIDENT_OVERDUE investigator', 'INCIDENT_OVERDUE member']);
      });

      it('not a locked member, not a member whose role is ADMIN, not somebody whose grant expired, not another team', async () => {
        for (const who of ['inactiveMember', 'adminMember', 'expiredGrantee', 'outsider']) expect(await noticesOf(who)).toEqual([]);
      });

      it('a record with a team and no investigator: the team is told', async () => {
        expect(await noticesFor(link('incidents', 'teamOnly'))).toEqual(['INCIDENT_OVERDUE grantee', 'INCIDENT_OVERDUE member']);
      });

      it('a record with an investigator and no team: the investigator alone is told', async () => {
        expect(await noticesFor(link('incidents', 'investigatorOnly'))).toEqual(['INCIDENT_OVERDUE loner']);
      });

      it('the investigator is told even when their role is ADMIN', async () => {
        expect(await noticesFor(link('incidents', 'adminInvestigator'))).toEqual(['INCIDENT_OVERDUE adminInvestigator']);
      });

      it('the investigator is told even when their account is locked', async () => {
        expect(await noticesFor(link('incidents', 'inactiveInvestigator'))).toEqual(['INCIDENT_OVERDUE inactiveInvestigator']);
      });

      it('for a petition the person who ENTERED it is told, with the team; the assignee is not', async () => {
        expect(await noticesFor(link('petitions', 'petitionOverdue'))).toEqual(['PETITION_OVERDUE enteredBy', 'PETITION_OVERDUE grantee', 'PETITION_OVERDUE member']);
        expect(await noticesOf('assignee')).toEqual([]);
      });

      it('a petition with an assignee but no team and nobody who entered it is never reported', async () => {
        expect(await noticesFor(link('petitions', 'petitionAssigneeOnly'))).toEqual([]);
      });
    });

    describe('what the notification says', () => {
      const one = async (recordLink: string, type: string) => {
        const [notice] = await scratch.db.notification.findMany({ where: { link: recordLink, userId: { in: [id.u_investigator, id.u_enteredBy] }, type: type as never } });
        return { type: notice.type, title: notice.title, message: notice.message, link: notice.link, metadata: notice.metadata, isRead: notice.isRead };
      };

      it('an overdue incident', async () => {
        expect(await one(link('incidents', 'overdue'), 'INCIDENT_OVERDUE')).toEqual({
          type: 'INCIDENT_OVERDUE',
          title: 'Vụ việc quá hạn',
          message: `${tag} quá hạn đã quá hạn xử lý`,
          link: `/incidents/${record.overdue.id}`,
          metadata: { incidentId: record.overdue.id },
          isRead: false,
        });
      });

      it('an incident near its deadline', async () => {
        expect(await one(link('incidents', 'inThree'), 'INCIDENT_DEADLINE_NEAR')).toEqual({
          type: 'INCIDENT_DEADLINE_NEAR',
          title: 'Vụ việc sắp đến hạn',
          message: `${tag} còn ba ngày — còn 3 ngày đến hạn xử lý`,
          link: `/incidents/${record.inThree.id}`,
          metadata: { incidentId: record.inThree.id },
          isRead: false,
        });
      });

      it('an overdue case', async () => {
        expect(await one(link('cases', 'caseOverdue'), 'CASE_OVERDUE')).toEqual({
          type: 'CASE_OVERDUE',
          title: 'Vụ án quá hạn',
          message: `${tag} án quá hạn đã quá hạn giải quyết`,
          link: `/cases/${record.caseOverdue.id}`,
          metadata: { caseId: record.caseOverdue.id },
          isRead: false,
        });
      });

      it('a case near its deadline', async () => {
        expect(await one(link('cases', 'caseInThree'), 'CASE_DEADLINE_NEAR')).toEqual({
          type: 'CASE_DEADLINE_NEAR',
          title: 'Vụ án sắp đến hạn',
          message: `${tag} án còn ba ngày — còn 3 ngày đến hạn giải quyết`,
          link: `/cases/${record.caseInThree.id}`,
          metadata: { caseId: record.caseInThree.id },
          isRead: false,
        });
      });

      it('an overdue petition is named by its sender', async () => {
        expect(await one(link('petitions', 'petitionOverdue'), 'PETITION_OVERDUE')).toEqual({
          type: 'PETITION_OVERDUE',
          title: 'Đơn thư quá hạn',
          message: `Đơn của ${tag} đơn quá hạn đã quá hạn xử lý`,
          link: `/petitions/${record.petitionOverdue.id}`,
          metadata: { petitionId: record.petitionOverdue.id },
          isRead: false,
        });
      });

      it('a petition near its deadline', async () => {
        expect(await one(link('petitions', 'petitionInThree'), 'PETITION_DEADLINE_NEAR')).toEqual({
          type: 'PETITION_DEADLINE_NEAR',
          title: 'Đơn thư sắp đến hạn',
          message: `Đơn của ${tag} đơn còn ba ngày — còn 3 ngày đến hạn xử lý`,
          link: `/petitions/${record.petitionInThree.id}`,
          metadata: { petitionId: record.petitionInThree.id },
          isRead: false,
        });
      });
    });

    describe('which statuses are still reminded', () => {
      const reminded = async (type: string, prefix: string) =>
        (await scratch.db.notification.findMany({ where: { userId: id.u_statusOwner, type: type as never } }))
          .map((x) => x.message.slice(prefix.length).split(' ')[0])
          .sort();
      const allBut = (statuses: string[], silent: string[]) => statuses.filter((s) => !silent.includes(s)).sort();

      it('an incident: every status except the eleven the scheduler treats as finished (suspended is one of them)', async () => {
        expect(SILENT.incident).toHaveLength(11);
        expect(await reminded('INCIDENT_OVERDUE', `${tag} trạng thái `)).toEqual(allBut(Object.values(IncidentStatus), SILENT.incident));
      });

      it('a case: every status except terminated, suspended, archived and concluded', async () => {
        expect(await reminded('CASE_OVERDUE', `${tag} trạng thái `)).toEqual(allBut(Object.values(CaseStatus), SILENT.case));
      });

      it('a petition: every status except resolved and the two "became an incident / a case"', async () => {
        expect(await reminded('PETITION_OVERDUE', `Đơn của ${tag} trạng thái `)).toEqual(allBut(Object.values(PetitionStatus), SILENT.petition));
      });

      it('the scheduler has its own idea of "finished": these finished statuses are still reminded', () => {
        const stillReminded = (kind: 'case' | 'incident' | 'petition') => TRANG_THAI_KET_THUC[kind].filter((s) => !SILENT[kind].includes(s)).sort();
        expect(stillReminded('incident')).toEqual(['DINH_CHI']);
        expect(stillReminded('case')).toEqual(['CHUYEN_XPHC', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC']);
        expect(stillReminded('petition')).toEqual([
          'CHUYEN_XPHC',
          'DA_CHUYEN_DON_VI',
          'DA_HUONG_DAN',
          'DA_LUU_DON',
          'DA_NHAP_HO_SO_KHAC',
          'DA_TRA_DON',
          'DINH_CHI',
          'KHONG_KHOI_TO',
          'PHAN_LOAI_DAN_SU',
        ]);
      });

      it('and these statuses that are NOT finished are never reminded', () => {
        const silentButOpen = (kind: 'case' | 'incident' | 'petition') =>
          SILENT[kind].filter((s) => !(TRANG_THAI_KET_THUC[kind] as string[]).includes(s)).sort();
        expect(silentButOpen('incident')).toEqual(['PHUC_HOI_NGUON_TIN', 'TAM_DINH_CHI']);
        expect(silentButOpen('case')).toEqual(['TAM_DINH_CHI']);
        // A suspended petition IS reminded: the scheduler's list for petitions does not have it.
        expect(silentButOpen('petition')).toEqual([]);
      });
    });

    describe('not twice within 24 hours', () => {
      it('the first run recorded, per record and person, that it told them', async () => {
        const marks = await scratch.db.overdueNotification.findMany({ where: { resourceId: record.overdue.id } });
        expect(marks.map((m) => `${m.resourceType} ${nameOf(m.userId)}`).sort()).toEqual(['incident grantee', 'incident investigator', 'incident member']);
        const near = await scratch.db.overdueNotification.findMany({ where: { resourceId: record.inThree.id, userId: id.u_investigator } });
        expect(near.map((m) => m.resourceType)).toEqual(['incident_near']);
      });

      it('a second run right after tells nobody again', async () => {
        const before = await scratch.db.notification.count({ where: { userId: { in: people() } } });
        expect(before).toBeGreaterThan(0);
        await scheduler.checkDeadlines();
        expect(await scratch.db.notification.count({ where: { userId: { in: people() } } })).toBe(before);
      });

      it('23 hours after the last notice: still silent', async () => {
        await scratch.db.overdueNotification.updateMany({ where: { resourceId: record.overdue.id }, data: { notifiedAt: subHours(new Date(), 23) } });
        await forget();
        await scheduler.checkDeadlines();
        expect(await noticesFor(link('incidents', 'overdue'))).toEqual([]);
      });

      it('25 hours after the last notice: told again, and the moment is recorded anew', async () => {
        await scratch.db.overdueNotification.updateMany({ where: { resourceId: record.overdue.id }, data: { notifiedAt: subHours(new Date(), 25) } });
        await forget();
        const started = Date.now();
        await scheduler.checkDeadlines();
        expect(await noticesFor(link('incidents', 'overdue'))).toEqual(['INCIDENT_OVERDUE grantee', 'INCIDENT_OVERDUE investigator', 'INCIDENT_OVERDUE member']);
        const marks = await scratch.db.overdueNotification.findMany({ where: { resourceId: record.overdue.id } });
        expect(marks).toHaveLength(3);
        for (const mark of marks) expect(mark.notifiedAt.getTime()).toBeGreaterThanOrEqual(started - 1000);
      });

      it('"near" and "overdue" are remembered apart: a record told as near yesterday is told as overdue once it is', async () => {
        await scratch.db.incident.update({ where: { id: record.inThree.id }, data: { deadline: subHours(new Date(), 1) } });
        await forget();
        await scheduler.checkDeadlines();
        expect(await noticesFor(link('incidents', 'inThree'))).toEqual(['INCIDENT_OVERDUE grantee', 'INCIDENT_OVERDUE investigator', 'INCIDENT_OVERDUE member']);
      });
    });

    describe('the warning threshold', () => {
      it('a value that is not a number falls back to 7 days: the deadline 6 days ahead is now reported', async () => {
        await setWarning('không phải số');
        try {
          await forget();
          await forgetDedupe();
          await scheduler.checkDeadlines();
          expect(await noticesFor(link('incidents', 'inSix'))).toEqual([
            'INCIDENT_DEADLINE_NEAR grantee',
            'INCIDENT_DEADLINE_NEAR investigator',
            'INCIDENT_DEADLINE_NEAR member',
          ]);
        } finally {
          await setWarning(String(WARNING_DAYS));
        }
      });

      it('a larger value widens the window: with 10 days the deadline 6 days ahead is reported "còn 6 ngày"', async () => {
        await setWarning('10');
        try {
          await forget();
          await forgetDedupe();
          await scheduler.checkDeadlines();
          const [notice] = await scratch.db.notification.findMany({ where: { link: link('incidents', 'inSix'), userId: id.u_investigator } });
          expect(notice.message).toBe(`${tag} còn sáu ngày — còn 6 ngày đến hạn xử lý`);
        } finally {
          await setWarning(String(WARNING_DAYS));
        }
      });
    });
  });
});
