import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { AuthzScopeService } from '../../authz/authz-scope.service';
import { AuthzService } from '../../authz/authz.service';
import { setEnforcement } from '../../authz/enforcement';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { installTriggerSection } from '../../common/testing/install-trigger-section';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { TeamsService } from '../../teams/teams.service';
import { bandInstants } from '../engine/bands';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { recordLink, refreshRecordAlert } from '../records/record-alert';
import { RecordStepAccessService } from '../records/record-step-access.service';
import { TRACKED_BANDS, type TrackedBand } from './band-conditions';
import { ProcessingTrackingService, type TrackingItem } from './processing-tracking.service';

/**
 * The tracking screen on a REAL PostgreSQL.
 *
 * WHO SEES WHAT is checked against a second source that shares no code with the query: `RecordGateway.canRead` with
 * `viaStep`, the answer of the route that opens the flow of ONE record. Every record of the suite carries exactly one
 * piece of work, so "the records this person finds on the tracking screen" must be exactly "the records this person may
 * open the flow of", in both modes of permissions by team. A few answers are also written out, so that the two sources
 * cannot agree on nothing.
 *
 * As in `gateway/record-gateway.database.spec.ts`, the mode row is not written (the database is shared): the permission
 * engine reads it through a wrapper that answers what this suite says.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const KINDS: RecordKind[] = ['PETITION', 'INCIDENT', 'CASE'];
type Who = 'owner' | 'member' | 'leader' | 'other' | 'admin' | 'unpermitted';
const PEOPLE: Who[] = ['owner', 'member', 'leader', 'other', 'admin', 'unpermitted'];
const T = { redDays: 1, yellowDays: 2, greenDays: 3 };
/** 10 December 2026, 10:00 in Vietnam. */
const NOW = new Date('2026-12-10T03:00:00.000Z');
/** The end of a December day in Vietnam. */
const endOf = (day: number) => new Date(`2026-12-${String(day).padStart(2, '0')}T16:59:59.999Z`);
const DUE: Record<TrackedBand | 'NONE', Date> = { OVERDUE: endOf(8), RED: endOf(11), YELLOW: endOf(12), GREEN: endOf(13), NONE: endOf(25) };

run('The tracking screen on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let gateway: RecordGateway;
  let tracking: ProcessingTrackingService;
  let authz: AuthzService;
  let enforced: AuthzScopeService;
  let mode: 'OFF' | 'ENFORCE' = 'OFF';
  const tag = `trk-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const roleOf: Record<string, { id: string; name: string }> = {};
  const grantedToAdmin: string[] = [];
  let createdAdminRole = false;
  let permissions: EnsuredPermissions;
  let stepConfig = '';
  let flowConfig = { flowId: '', versionId: '' };
  let counter = 0;
  /** name -> the record, for every record that carries exactly ONE piece of work. */
  const single: Record<string, { kind: RecordKind; id: string }> = {};

  const withMode = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) =>
              args.where.key === SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO ? Promise.resolve({ key: args.where.key, value: mode }) : setting.findUnique(args as never);
          },
        });
      },
    });

  const switchTo = async (next: typeof mode): Promise<void> => {
    mode = next;
    const bump = await scratch.db.team.create({ data: { code: `${tag}-bump-${randomUUID().slice(0, 6)}`, name: `${tag} bump ${randomUUID().slice(0, 6)}` } });
    await scratch.db.team.delete({ where: { id: bump.id } });
    await authz.refresh();
  };

  const user = (who: Who) => ({ id: id[who], role: roleOf[who].name, canDispatch: false });

  const record = async (kind: RecordKind, over: Record<string, unknown> = {}): Promise<string> => {
    const { db } = scratch;
    const n = ++counter;
    if (kind === 'PETITION') {
      return (await db.petition.create({ data: { stt: `${tag}-p${n}`, receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender ${n}`, loaiThongTin: 'Tố cáo', enteredById: id.owner, assignedTeamId: id.T, status: 'DANG_XU_LY', ...over } as never })).id;
    }
    if (kind === 'INCIDENT') {
      return (await db.incident.create({ data: { code: `${tag}-i${n}`, name: `${tag} incident ${n}`, loaiThongTin: 'Tố giác', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_XAC_MINH', ...over } as never })).id;
    }
    return (await db.case.create({ data: { name: `${tag} case ${n}`, caseCode: `${tag}-c${n}`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_DIEU_TRA', ...over } as never })).id;
  };

  interface StepSpec {
    due: Date;
    status?: 'OPEN' | 'REPORTED' | 'DONE' | 'WAITING_ANCHOR' | 'SKIPPED';
    parties: Array<{ teamId?: string | null; role?: 'MAIN' | 'CHECK' | 'COORDINATE' | 'INFORM'; assigneeUserId?: string }>;
  }

  /** The flow of a record with the steps given, written as rows; the stored alert is then computed by its own writer. */
  const flowOn = async (kind: RecordKind, recordId: string, steps: StepSpec[]): Promise<void> => {
    const { db } = scratch;
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL' } });
    for (const [order, spec] of steps.entries()) {
      const status = spec.status ?? 'OPEN';
      const waiting = status === 'WAITING_ANCHOR';
      await db.procRecordStep.create({
        data: {
          recordFlowId: flow.id,
          recordKind: kind,
          recordId,
          stepId: stepConfig,
          stepKey: `k${order + 1}`,
          order,
          status,
          ...(waiting ? {} : { startAt: new Date('2026-12-01T00:00:00Z'), regulatoryDueAt: spec.due, internalDueAt: spec.due, ...bandInstants(spec.due, T) }),
          ...(status === 'DONE' ? { doneAt: NOW } : {}),
          ...(status === 'SKIPPED' ? { skippedFrom: 'OPEN', skippedAt: NOW } : {}),
          parties: { create: spec.parties.map((party, at) => ({ partyKind: 'TEAM', teamId: party.teamId === undefined ? id.T : party.teamId, role: party.role ?? 'MAIN', assigneeUserId: party.assigneeUserId, order: at })) },
        },
      });
    }
    await db.$transaction((tx) => refreshRecordAlert(tx, gateway, kind, recordId));
  };

  const one = async (name: string, kind: RecordKind, band: TrackedBand | 'NONE', over: Record<string, unknown> = {}, party: StepSpec['parties'][number] = {}): Promise<string> => {
    const recordId = await record(kind, over);
    await flowOn(kind, recordId, [{ due: DUE[band], parties: [party] }]);
    single[name] = { kind, id: recordId };
    return recordId;
  };

  const allItems = async (who: Who, filter: Record<string, unknown> = {}): Promise<TrackingItem[]> => {
    const found: TrackingItem[] = [];
    for (let page = 1; ; page += 1) {
      const answer = await tracking.items(user(who), { asOf: NOW.toISOString(), page, pageSize: 100, ...filter });
      found.push(...answer.items);
      if (found.length >= answer.total || answer.items.length === 0) return found;
    }
  };
  const mine = (items: TrackingItem[]) => items.filter((item) => item.recordCode?.startsWith(tag));
  const namesOf = (items: TrackingItem[]) =>
    mine(items)
      .map((item) => Object.keys(single).find((name) => single[name].id === item.recordId) ?? `?${item.recordId}`)
      .sort();

  /** The second source: the records of the suite this person may open the flow of. */
  const mayOpen = async (who: Who): Promise<string[]> => {
    const names: string[] = [];
    for (const [name, { kind, id: recordId }] of Object.entries(single)) {
      if (expectedNoWork.has(name)) continue;
      if (await gateway.canRead(kind, recordId, user(who), { viaStep: true })) names.push(name);
    }
    return names.sort();
  };
  /** Records that carry no work at all (deleted, finished, suspended, not near any band). */
  const expectedNoWork = new Set<string>();

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db, pg } = scratch;
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    const keys = ['read:Petition', 'read:Incident', 'read:Case'];
    permissions = await ensurePermissions(scratch, keys);
    const reads = keys.map((key) => ({ permissionId: permissions.ids[key] }));
    const officer = await db.role.create({ data: { name: `${tag}-officer`, permissions: { create: reads } } });
    const bare = await db.role.create({ data: { name: `${tag}-bare` } });
    await takeTurnOnSharedRow(pg, 'admin-role');
    let admin = await db.role.findUnique({ where: { name: ROLE_NAMES.ADMIN } });
    if (!admin) {
      admin = await db.role.create({ data: { name: ROLE_NAMES.ADMIN } });
      createdAdminRole = true;
    }
    for (const key of keys) {
      const where = { roleId_permissionId: { roleId: admin.id, permissionId: permissions.ids[key] } };
      if (await db.rolePermission.findUnique({ where })) continue;
      await db.rolePermission.create({ data: where.roleId_permissionId });
      grantedToAdmin.push(permissions.ids[key]);
    }

    const person = async (who: Who, role: { id: string; name: string }, names: { firstName?: string; lastName?: string } = {}) => {
      roleOf[who] = { id: role.id, name: role.name };
      id[who] = (await db.user.create({ data: { username: `${tag}-${who}`, passwordHash: 'x', roleId: role.id, isActive: true, ...names } })).id;
    };
    await person('owner', officer);
    await person('member', officer, { firstName: 'An', lastName: 'Nguyễn' });
    await person('leader', officer, { firstName: 'Bình', lastName: 'Trần' });
    await person('other', officer);
    await person('admin', admin);
    await person('unpermitted', bare);

    // T holds most records; U is another unit; the owner sits in a unit of their own (O).
    for (const code of ['T', 'U', 'O']) id[code] = (await db.team.create({ data: { code: `${tag}-${code}`, name: `${tag} Tổ ${code}` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.member, teamId: id.T },
        { userId: id.leader, teamId: id.T, isLeader: true },
        { userId: id.unpermitted, teamId: id.T },
        { userId: id.owner, teamId: id.O },
        { userId: id.other, teamId: id.U },
      ],
    });
    // Used only when ENFORCE is on: a member of T reads petitions they entered themselves, and the incidents and cases
    // of exactly their team.
    id.template = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-m`,
          name: `${tag} member of T`,
          entries: { create: [{ permissionId: permissions.ids['read:Petition'], reach: 'OWN' }, { permissionId: permissions.ids['read:Incident'], reach: 'TEAM' }, { permissionId: permissions.ids['read:Case'], reach: 'TEAM' }] },
        },
      })
    ).id;
    await db.teamPermissionConfig.create({ data: { teamId: id.T, mode: 'EXPLICIT', memberTemplateId: id.template, leaderTemplateId: id.template } });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.owner, updatedById: id.owner } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.owner } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    stepConfig = (await db.procFlowStep.create({ data: { versionId: version.id, stepKey: 'k1', order: 0, name: `${tag} Verify`, durationValue: 5, durationUnit: 'DAY', anchor: 'RECEIVED', ...T } })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    tracking = new ProcessingTrackingService(prisma, scopes);
    tracking.now = () => NOW;

    AuthzService.enforceAvailable = true;
    authz = new AuthzService(withMode(db) as never);
    enforced = new AuthzScopeService(authz);
    await authz.refresh();
    enforced.onApplicationBootstrap();

    // ---- the records, each with ONE piece of work
    for (const kind of KINDS) {
      const k = kind[0];
      // Held by T, worked by T.
      await one(`${k}-own-overdue`, kind, 'OVERDUE');
      // Held by T, but the step names U: U's people reach it by the step alone.
      await one(`${k}-handed-red`, kind, 'RED', {}, { teamId: id.U });
      // Held and worked by U, owned by its own person.
      await one(`${k}-foreign-yellow`, kind, 'YELLOW', kind === 'PETITION' ? { enteredById: id.other, assignedTeamId: id.U } : { investigatorId: id.other, assignedTeamId: id.U }, { teamId: id.U });
      // Held by T, a person named on the work.
      await one(`${k}-named-green`, kind, 'GREEN', {}, { assigneeUserId: id.member });
      // No colour, or no clock: never counted.
      await one(`${k}-far`, kind, 'NONE');
      await one(`${k}-deleted`, kind, 'RED', { deletedAt: NOW });
      await one(`${k}-finished`, kind, 'RED', { status: kind === 'PETITION' ? 'DA_GIAI_QUYET' : kind === 'INCIDENT' ? 'DA_GIAI_QUYET' : 'DA_KET_LUAN' });
      await one(`${k}-suspended`, kind, 'RED', { status: 'TAM_DINH_CHI' });
      for (const name of ['far', 'deleted', 'finished', 'suspended']) expectedNoWork.add(`${k}-${name}`);
    }
    // A restricted case whose step names U: the step never lifts the sensitivity rule.
    await one('C-restricted-handed', 'CASE', 'RED', { sensitivity: 'RESTRICTED' }, { teamId: id.U });
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    enforced?.onModuleDestroy();
    setEnforcement(null);
    AuthzService.enforceAvailable = false;
    authz?.onModuleDestroy();
    const flows = { flowId: flowConfig.flowId };
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordPause.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    const admin = await db.role.findUnique({ where: { name: ROLE_NAMES.ADMIN } });
    if (admin && grantedToAdmin.length > 0) await db.rolePermission.deleteMany({ where: { roleId: admin.id, permissionId: { in: grantedToAdmin } } });
    if (createdAdminRole) await db.role.deleteMany({ where: { name: ROLE_NAMES.ADMIN } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  /** In either mode: the list is exactly what the person may open, and the cards count exactly the list. */
  const agreesWithTheRecordPolicy = () => {
    it.each(PEOPLE)('%s finds exactly the work of the records they may open the flow of', async (who) => {
      expect(namesOf(await allItems(who))).toEqual(await mayOpen(who));
    });

    it.each(PEOPLE)('%s: each card counts exactly the rows of its list, at the instant the cards were judged', async (who) => {
      const summary = await tracking.summary(user(who), {});
      expect(summary.asOf).toBe(NOW.toISOString());
      // Other suites may leave work an administrator also sees; the comparison is count against list, both unfiltered.
      for (const band of TRACKED_BANDS) {
        const list = await tracking.items(user(who), { asOf: summary.asOf, band, pageSize: 1 });
        expect({ band, total: list.total }).toEqual({ band, total: summary.counts[band] });
      }
      const any = await tracking.items(user(who), { asOf: summary.asOf, pageSize: 1 });
      expect(any.total).toBe(TRACKED_BANDS.reduce((sum, band) => sum + summary.counts[band], 0));
    });

    it('nobody finds a record that is deleted, finished or suspended, or work that has no colour yet', async () => {
      const seen = namesOf(await allItems('admin'));
      expect(seen.filter((name) => expectedNoWork.has(name))).toEqual([]);
      expect(seen).toContain('P-own-overdue');
    });

    it('a restricted case is not found through a step that names the unit', async () => {
      expect(namesOf(await allItems('other'))).not.toContain('C-restricted-handed');
      expect(await gateway.canRead('CASE', single['C-restricted-handed'].id, user('other'), { viaStep: true })).toBe(false);
    });
  };

  describe('permissions by team OFF', () => {
    it('permissions by team are not enforced', () => {
      expect(authz.state()).not.toBe('ENFORCE');
    });

    agreesWithTheRecordPolicy();

    it('a person whose role holds no read permission of any kind finds nothing, even in the unit that holds the records', async () => {
      expect(mine(await allItems('unpermitted'))).toEqual([]);
      expect(await tracking.summary(user('unpermitted'), {})).toEqual({ asOf: NOW.toISOString(), counts: { OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0 }, unconfirmed: 0 });
    });

    it('a member of the unit that holds the records finds its work, and nothing of another unit', async () => {
      expect(namesOf(await allItems('member'))).toEqual(['C-handed-red', 'C-named-green', 'C-own-overdue', 'I-handed-red', 'I-named-green', 'I-own-overdue', 'P-handed-red', 'P-named-green', 'P-own-overdue']);
    });

    it('a person of the unit a step names finds that work on records their scope does not reach, and their own unit\'s', async () => {
      expect(namesOf(await allItems('other'))).toEqual(['C-foreign-yellow', 'C-handed-red', 'I-foreign-yellow', 'I-handed-red', 'P-foreign-yellow', 'P-handed-red']);
    });
  });

  describe('permissions by team ENFORCED', () => {
    beforeAll(() => switchTo('ENFORCE'));
    afterAll(() => switchTo('OFF'));

    it('permissions by team are enforced', () => {
      expect(authz.state()).toBe('ENFORCE');
    });

    agreesWithTheRecordPolicy();

    it('a member of T finds the incidents and cases of exactly their unit; of the petitions (none is theirs) only the work whose step names them or their unit', async () => {
      // `P-handed-red` is a petition of T too, but its step names U: neither the scope (own petitions) nor the step reaches it.
      expect(namesOf(await allItems('member'))).toEqual(['C-handed-red', 'C-named-green', 'C-own-overdue', 'I-handed-red', 'I-named-green', 'I-own-overdue', 'P-named-green', 'P-own-overdue']);
    });

    it('a person of an unconfigured unit finds only the work a step hands them', async () => {
      const seen = namesOf(await allItems('other'));
      expect(seen).toEqual(expect.arrayContaining(['P-handed-red', 'I-handed-red', 'C-handed-red']));
      expect(seen.filter((name) => name.includes('own-overdue') || name.includes('named-green'))).toEqual([]);
    });
  });

  describe('what is counted, and the filters', () => {
    const only = async (who: Who, filter: Record<string, unknown>) => namesOf(await allItems(who, filter));

    it('a row says which record, which step, which unit, who answers for it, and how urgent', async () => {
      const [row] = mine(await allItems('member', { kind: 'PETITION', band: 'GREEN' }));
      expect(row).toMatchObject({
        recordKind: 'PETITION',
        recordId: single['P-named-green'].id,
        stepKey: 'k1',
        stepName: `${tag} Verify`,
        teamId: id.T,
        teamName: `${tag} Tổ T`,
        assigneeUserId: id.member,
        responsibleName: 'Nguyễn An',
        dueAt: DUE.GREEN.toISOString(),
        band: 'GREEN',
        remainingDays: 3,
      });
      // Nobody named: the head of the unit answers for it.
      const [headed] = mine(await allItems('member', { kind: 'PETITION', band: 'OVERDUE' }));
      expect(headed).toMatchObject({ assigneeUserId: null, responsibleName: 'Trần Bình', band: 'OVERDUE', remainingDays: -2 });
      // A case shows its code and not its name.
      const [aCase] = mine(await allItems('member', { kind: 'CASE', band: 'OVERDUE' }));
      expect(aCase).toMatchObject({ recordKind: 'CASE', recordLabel: null });
      expect(aCase.recordCode).toContain(`${tag}-c`);
      expect(row.recordLabel).toContain(`${tag} sender`);
    });

    it('filters by band, by kind, by unit', async () => {
      expect(await only('admin', { band: 'RED', kind: 'INCIDENT' })).toEqual(['I-handed-red']);
      expect(await only('admin', { kind: 'CASE', teamId: id.T })).toEqual(['C-named-green', 'C-own-overdue']);
      expect(await only('admin', { teamId: id.U, band: 'YELLOW' })).toEqual(['C-foreign-yellow', 'I-foreign-yellow', 'P-foreign-yellow']);
    });

    it('the units of the filter are exactly the units holding work the person may see', async () => {
      const unitsOf = async (who: Who) => (await tracking.teams(user(who))).filter((team) => team.name.startsWith(tag)).map((team) => team.name);
      expect(await unitsOf('other')).toEqual([`${tag} Tổ U`]);
      expect(await unitsOf('unpermitted')).toEqual([]);
      // Every unit offered has rows, and every unit of a row is offered.
      for (const who of ['admin', 'member', 'other'] as Who[]) {
        const offered = (await tracking.teams(user(who))).map((team) => team.id).sort();
        const inRows = [...new Set((await allItems(who)).flatMap((item) => (item.teamId ? [item.teamId] : [])))].sort();
        expect(offered).toEqual(inRows);
      }
      expect((await tracking.teams(user('admin')))[0]).toEqual({ id: expect.any(String), name: expect.any(String), parentTeamId: null });
    });

    it('"my work": named on it, or heading the unit when nobody is named', async () => {
      expect(await only('member', { mine: true })).toEqual(['C-named-green', 'I-named-green', 'P-named-green']);
      // The head answers for the work of the unit nobody is named on; work with a name on it is that person's.
      expect(await only('leader', { mine: true })).toEqual(['C-own-overdue', 'I-own-overdue', 'P-own-overdue']);
      expect(await only('admin', { mine: true })).toEqual([]);
    });

    it('the most urgent first, and pages never repeat or skip a row', async () => {
      const whole = mine(await allItems('admin'));
      expect(whole.map((item) => item.dueAt)).toEqual([...whole.map((item) => item.dueAt)].sort());
      const paged: string[] = [];
      const first = await tracking.items(user('member'), { asOf: NOW.toISOString(), pageSize: 2 });
      for (let page = 1; page <= Math.ceil(first.total / 2); page += 1) {
        paged.push(...(await tracking.items(user('member'), { asOf: NOW.toISOString(), page, pageSize: 2 })).items.map((item) => `${item.recordId}:${item.stepKey}:${item.teamId}`));
      }
      expect(new Set(paged).size).toBe(paged.length);
      expect(paged).toHaveLength(first.total);
    });

    it('exactly at the deadline the work is still RED; one millisecond later it is OVERDUE', async () => {
      const at = (instant: Date) => tracking.items(user('admin'), { asOf: instant.toISOString(), kind: 'INCIDENT', teamId: id.U, pageSize: 100 });
      const bandOf = (items: TrackingItem[]) => items.find((item) => item.recordId === single['I-handed-red'].id)?.band;
      expect(bandOf((await at(DUE.RED)).items)).toBe('RED');
      expect(bandOf((await at(new Date(DUE.RED.getTime() + 1))).items)).toBe('OVERDUE');
      const red = await tracking.items(user('admin'), { asOf: DUE.RED.toISOString(), kind: 'INCIDENT', teamId: id.U, band: 'RED', pageSize: 100 });
      expect(red.items.map((item) => item.recordId)).toContain(single['I-handed-red'].id);
    });

    it('work is a step being worked x a MAIN party: two MAIN parties are two, other roles and other steps are none', async () => {
      const recordId = await record('PETITION');
      await flowOn('PETITION', recordId, [
        { due: DUE.RED, parties: [{ teamId: id.T }, { teamId: id.U }, { teamId: id.O, role: 'CHECK' }, { teamId: id.O, role: 'INFORM' }] },
        { due: DUE.OVERDUE, status: 'DONE', parties: [{ teamId: id.T }] },
        { due: DUE.OVERDUE, status: 'SKIPPED', parties: [{ teamId: id.T }] },
        { due: DUE.NONE, status: 'WAITING_ANCHOR', parties: [{ teamId: id.T }] },
        { due: DUE.YELLOW, status: 'REPORTED', parties: [{ teamId: id.T }] },
      ]);
      const rows = (await allItems('admin', { kind: 'PETITION' })).filter((item) => item.recordId === recordId);
      expect(rows.map((item) => [item.stepKey, item.teamId, item.band]).sort()).toEqual([['k1', id.T, 'RED'], ['k1', id.U, 'RED'], ['k5', id.T, 'YELLOW']].sort());
      // Each piece of work has its own id (the party row): the two MAIN parties of step k1 share record and step, not id.
      const ids = rows.map((item) => item.id);
      expect(ids.every((value) => typeof value === 'string' && value !== '')).toBe(true);
      expect(new Set(ids).size).toBe(3);
      const parties = await scratch.db.procRecordStepParty.findMany({ where: { id: { in: ids } }, select: { id: true, teamId: true, role: true } });
      expect(parties.map((party) => [party.teamId, party.role]).sort()).toEqual([[id.T, 'MAIN'], [id.T, 'MAIN'], [id.U, 'MAIN']].sort());
      // A person of U sees the step that names U, and not the other step of the same record.
      expect((await allItems('other', { kind: 'PETITION' })).filter((item) => item.recordId === recordId).map((item) => item.stepKey)).toEqual(['k1', 'k1']);
    });

    it('a record whose clock is paused has no work', async () => {
      const recordId = await record('INCIDENT');
      await flowOn('INCIDENT', recordId, [{ due: DUE.RED, parties: [{}] }]);
      const seen = async () => (await allItems('admin', { kind: 'INCIDENT' })).some((item) => item.recordId === recordId);
      expect(await seen()).toBe(true);
      const flow = await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId } });
      await scratch.db.procRecordPause.create({ data: { recordFlowId: flow.id, from: NOW, reason: 'SUSPENDED' } });
      await scratch.db.$transaction((tx) => refreshRecordAlert(tx, gateway, 'INCIDENT', recordId));
      expect(await seen()).toBe(false);
    });
    it('a record finished, suspended or deleted a moment ago has no work at once, before any worker has looked (found by Codex)', async () => {
      const cases: Array<[RecordKind, Record<string, unknown>]> = [
        ['PETITION', { status: 'DA_GIAI_QUYET' }],
        ['INCIDENT', { status: 'TAM_DINH_CHI' }],
        ['CASE', { status: 'DINH_CHI' }],
        ['PETITION', { deletedAt: new Date() }],
      ];
      for (const [kind, change] of cases) {
        const recordId = await record(kind);
        await flowOn(kind, recordId, [{ due: DUE.OVERDUE, parties: [{}] }]);
        const seen = async () => (await allItems('admin', { kind })).some((item) => item.recordId === recordId);
        const overdue = async () => (await tracking.summary(user('admin'), { asOf: NOW.toISOString(), kind })).counts.OVERDUE;
        expect(await seen()).toBe(true);
        const before = await overdue();
        // The record's own service changes the status and tells the flow nothing: the stored alert is still there.
        const model = kind === 'PETITION' ? scratch.db.petition : kind === 'INCIDENT' ? scratch.db.incident : scratch.db.case;
        await (model as unknown as { update(args: unknown): Promise<unknown> }).update({ where: { id: recordId }, data: change });
        expect((await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId } })).alertDueAt).not.toBeNull();
        expect(await seen()).toBe(false);
        expect(await overdue()).toBe(before - 1);
      }
    });

    describe('a flow that is only a proposal (decision C10)', () => {
      const confirm = (recordId: string, confirmed: boolean) => scratch.db.procRecordFlow.updateMany({ where: { recordId }, data: { confirmed } });
      const summaryOf = (who: Who, filter: Record<string, unknown> = {}) => tracking.summary(user(who), { asOf: NOW.toISOString(), ...filter });
      const seenBy = async (who: Who, recordId: string, filter: Record<string, unknown> = {}) => (await allItems(who, filter)).filter((item) => item.recordId === recordId).length;

      it('its work is in no card and on no list, at once; the record is counted apart, and comes back when the flow is confirmed', async () => {
        const recordId = await record('PETITION');
        // One record, two pieces of work (two MAIN parties) and a second step: still ONE record that waits for a flow.
        await flowOn('PETITION', recordId, [{ due: DUE.OVERDUE, parties: [{ teamId: id.T }, { teamId: id.U }] }, { due: DUE.RED, parties: [{ teamId: id.T }] }]);
        const filter = { kind: 'PETITION' as const, teamId: id.T };
        const before = await summaryOf('admin', filter);
        expect(await seenBy('admin', recordId)).toBe(3);

        // Nothing refreshes the stored alert here: the screen asks the flow itself.
        await confirm(recordId, false);
        expect((await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId } })).alertDueAt).not.toBeNull();
        expect(await seenBy('admin', recordId)).toBe(0);
        for (const band of TRACKED_BANDS) expect(await seenBy('admin', recordId, { band })).toBe(0);
        const proposed = await summaryOf('admin', filter);
        expect(proposed.counts).toEqual({ ...before.counts, OVERDUE: before.counts.OVERDUE - 1, RED: before.counts.RED - 1 });
        expect(proposed.unconfirmed).toBe(before.unconfirmed + 1);
        // The cards still count exactly the list.
        const any = await tracking.items(user('admin'), { asOf: NOW.toISOString(), pageSize: 1, ...filter });
        expect(any.total).toBe(TRACKED_BANDS.reduce((sum, band) => sum + proposed.counts[band], 0));

        await confirm(recordId, true);
        expect(await seenBy('admin', recordId)).toBe(3);
        expect(await summaryOf('admin', filter)).toEqual(before);
      });

      it('the number counted apart follows the reach of the person and the filters, as the cards do', async () => {
        const base = {
          adminT: (await summaryOf('admin', { teamId: id.T })).unconfirmed,
          adminIncident: (await summaryOf('admin', { kind: 'INCIDENT' })).unconfirmed,
          adminU: (await summaryOf('admin', { teamId: id.U })).unconfirmed,
          member: (await summaryOf('member')).unconfirmed,
          memberMine: (await summaryOf('member', { mine: true })).unconfirmed,
          other: (await summaryOf('other')).unconfirmed,
        };
        expect(base.adminT).toEqual(expect.any(Number));
        // A petition of unit T, worked by T, with the member named on it: a proposal.
        const recordId = await record('PETITION');
        await flowOn('PETITION', recordId, [{ due: DUE.YELLOW, parties: [{ teamId: id.T, assigneeUserId: id.member }] }]);
        await confirm(recordId, false);

        expect((await summaryOf('admin', { teamId: id.T })).unconfirmed).toBe(base.adminT + 1);
        expect((await summaryOf('admin', { kind: 'PETITION' })).unconfirmed).toBeGreaterThanOrEqual(1);
        expect((await summaryOf('admin', { kind: 'INCIDENT' })).unconfirmed).toBe(base.adminIncident);
        expect((await summaryOf('admin', { teamId: id.U })).unconfirmed).toBe(base.adminU);
        expect((await summaryOf('member')).unconfirmed).toBe(base.member + 1);
        expect((await summaryOf('member', { mine: true })).unconfirmed).toBe(base.memberMine + 1);
        expect((await summaryOf('leader', { mine: true })).unconfirmed).toBe(0);
        // A person of another unit, whom no step of the record names, does not learn that it exists.
        expect((await summaryOf('other')).unconfirmed).toBe(base.other);
        expect(await summaryOf('unpermitted')).toMatchObject({ unconfirmed: 0 });

        // A proposal on a record that is finished waits for nobody.
        await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DA_GIAI_QUYET' } });
        expect((await summaryOf('member')).unconfirmed).toBe(base.member);
      });

      it('a proposal none of whose steps is being worked yet still waits for a person: counted, until it is confirmed or its record is finished or deleted (found by Codex)', async () => {
        const filter = { kind: 'PETITION' as const, teamId: id.T };
        const count = async (who: Who, over: Record<string, unknown> = filter) => (await summaryOf(who, over)).unconfirmed;
        const recordId = await record('PETITION');
        // The flow starts at a date nobody has recorded: its only step waits, and a later one is done already.
        await flowOn('PETITION', recordId, [{ due: DUE.NONE, status: 'WAITING_ANCHOR', parties: [{ teamId: id.T }] }, { due: DUE.OVERDUE, status: 'DONE', parties: [{ teamId: id.T }] }]);
        const setStatus = (data: Record<string, unknown>) => scratch.db.petition.update({ where: { id: recordId }, data: data as never });
        // Confirmed: not counted.
        const base = { admin: await count('admin'), member: await count('member', {}), leaderMine: await count('leader', { mine: true }), other: await count('other', {}), adminU: await count('admin', { teamId: id.U }), incident: await count('admin', { kind: 'INCIDENT' }) };

        await confirm(recordId, false);
        expect(await count('admin')).toBe(base.admin + 1);
        expect(await count('member', {})).toBe(base.member + 1);
        // Nobody is named on it: the head of the unit answers for it.
        expect(await count('leader', { mine: true })).toBe(base.leaderMine + 1);
        expect(await count('admin', { teamId: id.U })).toBe(base.adminU);
        expect(await count('admin', { kind: 'INCIDENT' })).toBe(base.incident);
        // Outside the reach: a person of another unit no step names, and a person with no read permission.
        expect(await count('other', {})).toBe(base.other);
        expect(await count('unpermitted', {})).toBe(0);
        // It is in no card all the while.
        expect(await seenBy('admin', recordId)).toBe(0);

        // A suspended record still waits for its flow to be confirmed; a finished or a deleted one does not.
        await setStatus({ status: 'TAM_DINH_CHI' });
        expect(await count('admin')).toBe(base.admin + 1);
        await setStatus({ status: 'DA_GIAI_QUYET' });
        expect(await count('admin')).toBe(base.admin);
        await setStatus({ status: 'DANG_XU_LY', deletedAt: NOW });
        expect(await count('admin')).toBe(base.admin);
        await setStatus({ deletedAt: null });
        expect(await count('admin')).toBe(base.admin + 1);

        await confirm(recordId, true);
        expect(await count('admin')).toBe(base.admin);
        expect(await count('member', {})).toBe(base.member);
      });
    });

    it('an open pause stops the work at once, even while the stored alert has not followed', async () => {
      const recordId = await record('INCIDENT');
      await flowOn('INCIDENT', recordId, [{ due: DUE.RED, parties: [{}] }]);
      const flow = await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId } });
      await scratch.db.procRecordPause.create({ data: { recordFlowId: flow.id, from: NOW, reason: 'SUSPENDED' } });
      expect((await allItems('admin', { kind: 'INCIDENT' })).some((item) => item.recordId === recordId)).toBe(false);
    });
  });
});
