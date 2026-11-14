import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { AuthzScopeService } from '../../authz/authz-scope.service';
import { AuthzService } from '../../authz/authz.service';
import { setEnforcement } from '../../authz/enforcement';
import { CasesService } from '../../cases/cases.service';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { installTriggerSection } from '../../common/testing/install-trigger-section';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { IncidentsService } from '../../incidents/incidents.service';
import { PetitionsService } from '../../petitions/petitions.service';
import { TeamsService } from '../../teams/teams.service';
import { CaseAdapter } from './case.adapter';
import { IncidentAdapter } from './incident.adapter';
import { PetitionAdapter } from './petition.adapter';
import { RecordGateway } from './record-gateway';
import type { RecordKind } from './record-snapshot';

/**
 * The record gateway on a REAL PostgreSQL: `canRead` answers what the record's own detail route answers, and `load`
 * returns the stored record.
 *
 * Two sources say what is expected, and they must agree with the gateway and with each other:
 *   - the table written out below, from the rules of the read scope (who entered / investigates a record, the team it
 *     is assigned to, an administrator);
 *   - the detail route itself, run piece by piece with the real classes: the route guard (`read:<Subject>`), the scope
 *     the request would carry, and `getById` of the record's own service.
 *
 * Both modes of permissions by team are covered. As in `authz/enforce-end-to-end.database.spec.ts`, the mode row is
 * not written (the database is shared and ENFORCE would switch every other suite over): the permission engine reads
 * it through a wrapper that answers what this suite says. Everything else is the real thing.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const SUBJECT = { PETITION: 'Petition', INCIDENT: 'Incident', CASE: 'Case' } as const;
const KINDS: RecordKind[] = ['PETITION', 'INCIDENT', 'CASE'];
type Who = 'owner' | 'member' | 'other' | 'admin' | 'unpermitted' | 'assignee';

run('RecordGateway on PostgreSQL', () => {
  jest.setTimeout(120_000);
  let scratch: ScratchDatabase;
  let gateway: RecordGateway;
  let scopes: UnitScopeService;
  let petitions: PetitionsService;
  let incidents: IncidentsService;
  let cases: CasesService;
  let authz: AuthzService;
  let enforced: AuthzScopeService;
  let mode: 'OFF' | 'ENFORCE' = 'OFF';
  const tag = `rgw-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const roleOf: Record<string, { id: string; name: string }> = {};
  const record = {} as Record<RecordKind, string>;
  const deleted = {} as Record<RecordKind, string>;
  const grantedToAdmin: string[] = [];
  let createdAdminRole = false;
  let permissions: EnsuredPermissions;

  /** The real client, except that the mode row says what this suite says. */
  const withMode = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) =>
              args.where.key === SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO
                ? Promise.resolve({ key: args.where.key, value: mode })
                : setting.findUnique(args as never);
          },
        });
      },
    });

  const switchTo = async (next: typeof mode): Promise<void> => {
    mode = next;
    // A snapshot is rebuilt when the change log moved; the mode row is not written here, so something logged is.
    const bump = await scratch.db.team.create({ data: { code: `${tag}-bump-${randomUUID().slice(0, 6)}`, name: `${tag} bump` } });
    await scratch.db.team.delete({ where: { id: bump.id } });
    await authz.refresh();
  };

  const user = (who: Who) => ({ id: id[who], role: roleOf[who].name, canDispatch: false });

  /** `GET /<kind>/:id` for this person, piece by piece: guard, request scope, the service's `getById`. */
  const detailRouteShows = async (kind: RecordKind, recordId: string, who: Who): Promise<boolean> => {
    const context = {
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({ getRequest: () => ({ user: { id: id[who], roleId: roleOf[who].id } }) }),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: (key: string) => (key === PERMISSIONS_KEY ? [{ action: 'read', subject: SUBJECT[kind] }] : undefined),
    } as unknown as Reflector;
    try {
      await new PermissionsGuard(reflector, scratch.db as never).canActivate(context);
      const scope = await scopes.resolveScope(id[who], roleOf[who].name, false);
      if (kind === 'PETITION') await petitions.getById(recordId, scope);
      else if (kind === 'INCIDENT') await incidents.getById(recordId, scope);
      else await cases.getById(recordId, scope, id[who]);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  };

  /** One line per person: what the gateway says for the petition, the incident and the case. */
  const answers = async (who: Who, ids: Record<RecordKind, string> = record) =>
    Object.fromEntries(await Promise.all(KINDS.map(async (kind) => [kind, await gateway.canRead(kind, ids[kind], user(who))]))) as Record<RecordKind, boolean>;
  const routeAnswers = async (who: Who, ids: Record<RecordKind, string> = record) => {
    const out = {} as Record<RecordKind, boolean>;
    for (const kind of KINDS) out[kind] = await detailRouteShows(kind, ids[kind], who);
    return out;
  };
  const all = (value: boolean) => ({ PETITION: value, INCIDENT: value, CASE: value });

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db, pg } = scratch;
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    // Permission rows are the whole database's: the ones this suite has to create are taken back at the end.
    permissions = await ensurePermissions(scratch, Object.values(SUBJECT).map((subject) => `read:${subject}`));
    const perm: Record<string, string> = {};
    for (const subject of Object.values(SUBJECT)) perm[subject] = permissions.ids[`read:${subject}`];
    const reads = Object.values(perm).map((permissionId) => ({ permissionId }));
    const officer = await db.role.create({ data: { name: `${tag}-officer`, permissions: { create: reads } } });
    const bare = await db.role.create({ data: { name: `${tag}-bare` } });

    // An administrator is whoever has the role NAMED ADMIN. The role is created only if the database has none, and
    // is given the three read permissions it lacks; both are taken back at the end.
    await takeTurnOnSharedRow(pg, 'admin-role');
    let admin = await db.role.findUnique({ where: { name: ROLE_NAMES.ADMIN } });
    if (!admin) {
      admin = await db.role.create({ data: { name: ROLE_NAMES.ADMIN } });
      createdAdminRole = true;
    }
    for (const permissionId of Object.values(perm)) {
      const where = { roleId_permissionId: { roleId: admin.id, permissionId } };
      if (await db.rolePermission.findUnique({ where })) continue;
      await db.rolePermission.create({ data: { roleId: admin.id, permissionId } });
      grantedToAdmin.push(permissionId);
    }

    const person = async (who: Who, role: { id: string; name: string }) => {
      roleOf[who] = { id: role.id, name: role.name };
      id[who] = (await db.user.create({ data: { username: `${tag}-${who}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    };
    await person('owner', officer);
    await person('member', officer);
    await person('other', officer);
    await person('assignee', officer);
    await person('admin', admin);
    await person('unpermitted', bare);

    // T holds the records. The owner sits in a team of their own (O), the outsider in U; neither is configured.
    id.T = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ T` } })).id;
    id.O = (await db.team.create({ data: { code: `${tag}-O`, name: `${tag} Tổ O` } })).id;
    id.U = (await db.team.create({ data: { code: `${tag}-U`, name: `${tag} Tổ U` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.member, teamId: id.T },
        { userId: id.unpermitted, teamId: id.T },
        { userId: id.owner, teamId: id.O },
        { userId: id.other, teamId: id.U },
        { userId: id.assignee, teamId: id.U },
      ],
    });
    // Used only when ENFORCE is on: a member of T reads petitions they entered themselves, and the incidents and cases
    // of exactly their team.
    id.template = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-m`,
          name: `${tag} member of T`,
          entries: {
            create: [
              { permissionId: perm.Petition, reach: 'OWN' },
              { permissionId: perm.Incident, reach: 'TEAM' },
              { permissionId: perm.Case, reach: 'TEAM' },
            ],
          },
        },
      })
    ).id;
    await db.teamPermissionConfig.create({ data: { teamId: id.T, mode: 'EXPLICIT', memberTemplateId: id.template, leaderTemplateId: id.template } });

    const petition = (suffix: string, over: Record<string, unknown> = {}) =>
      db.petition.create({
        data: {
          stt: `${tag}-${suffix}`,
          receivedDate: new Date('2026-01-05T00:00:00Z'),
          gioTiepNhan: '09:30',
          senderName: `${tag} người gửi`,
          loaiThongTin: 'Tố cáo',
          enteredById: id.owner,
          assignedToId: id.assignee,
          assignedTeamId: id.T,
          status: 'DANG_XU_LY',
          deadline: new Date('2026-02-04T00:00:00Z'),
          ngayDeXuat: new Date('2026-01-06T00:00:00Z'),
          ngayGiaoDonViGiaiQuyet: new Date('2026-01-07T00:00:00Z'),
          ...over,
        } as never,
      });
    const incident = (suffix: string, over: Record<string, unknown> = {}) =>
      db.incident.create({
        data: {
          code: `${tag}-${suffix}`,
          name: `${tag} vụ việc`,
          loaiThongTin: 'Tố giác',
          investigatorId: id.owner,
          assignedTeamId: id.T,
          status: 'TAM_DINH_CHI',
          ngayTiepNhanNguonTin: new Date('2026-01-02T00:00:00Z'),
          ngayDeXuat: new Date('2026-01-05T00:00:00Z'),
          ...over,
        } as never,
      });
    const aCase = (suffix: string, over: Record<string, unknown> = {}) =>
      db.case.create({
        data: {
          name: `${tag} vụ án ${suffix}`,
          caseCode: `${tag}-${suffix}`,
          caseProvenance: 'DIRECT_DISCOVERY',
          investigatorId: id.owner,
          assignedTeamId: id.T,
          status: 'DA_KET_LUAN',
          receiveDate: new Date('2026-01-08T00:00:00Z'),
          ngayKhoiTo: new Date('2026-02-01T00:00:00Z'),
          ...over,
        } as never,
      });
    record.PETITION = (await petition('p')).id;
    record.INCIDENT = (await incident('i')).id;
    record.CASE = (await aCase('c')).id;
    deleted.PETITION = (await petition('p-del', { deletedAt: new Date() })).id;
    deleted.INCIDENT = (await incident('i-del', { deletedAt: new Date() })).id;
    deleted.CASE = (await aCase('c-del', { deletedAt: new Date() })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    // The services of the three detail routes; reading a record uses nothing but the database.
    petitions = new PetitionsService(prisma, audit, {} as never, {} as never, {} as never, { emit: () => false } as never, {} as never, {} as never, {} as never);
    incidents = new IncidentsService(prisma, audit, {} as never, {} as never, {} as never, { emit: () => false } as never, {} as never, {} as never);
    cases = new CasesService(prisma, audit, {} as never, {} as never, { emit: () => false } as never);

    // The permission engine, loaded and registered as in the running application; OFF until a test says otherwise.
    AuthzService.enforceAvailable = true;
    authz = new AuthzService(withMode(db) as never);
    enforced = new AuthzScopeService(authz);
    await authz.refresh();
    enforced.onApplicationBootstrap();
  });

  afterAll(async () => {
    const { db } = scratch;
    enforced?.onModuleDestroy();
    setEnforcement(null);
    AuthzService.enforceAvailable = false;
    authz?.onModuleDestroy();
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
    if (admin && grantedToAdmin.length > 0) {
      await db.rolePermission.deleteMany({ where: { roleId: admin.id, permissionId: { in: grantedToAdmin } } });
    }
    if (createdAdminRole) await db.role.deleteMany({ where: { name: ROLE_NAMES.ADMIN } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  describe('canRead, permissions by team OFF', () => {
    it('permissions by team are not enforced', () => {
      expect(authz.state()).toBe('OFF');
    });

    it('(a) the owner reads the record: who investigates an incident or a case, who entered a petition', async () => {
      expect(await answers('owner')).toEqual(all(true));
      expect(await routeAnswers('owner')).toEqual(all(true));
    });

    it('(b) a member of the assigned team reads it', async () => {
      expect(await answers('member')).toEqual(all(true));
      expect(await routeAnswers('member')).toEqual(all(true));
    });

    it('(c) an officer of another team does not', async () => {
      expect(await answers('other')).toEqual(all(false));
      expect(await routeAnswers('other')).toEqual(all(false));
    });

    it('(d) an administrator reads it', async () => {
      expect(await answers('admin')).toEqual(all(true));
      expect(await routeAnswers('admin')).toEqual(all(true));
    });

    it('a member of the assigned team whose role may not read that kind of record does not', async () => {
      expect(await answers('unpermitted')).toEqual(all(false));
      expect(await routeAnswers('unpermitted')).toEqual(all(false));
    });

    it('the ASSIGNEE of a petition, in another team, does not read it: the read scope goes by who entered it', async () => {
      expect(await gateway.canRead('PETITION', record.PETITION, user('assignee'))).toBe(false);
      expect(await detailRouteShows('PETITION', record.PETITION, 'assignee')).toBe(false);
    });

    it('a deleted record is read by nobody, not even an administrator', async () => {
      expect(await answers('admin', deleted)).toEqual(all(false));
      expect(await routeAnswers('admin', deleted)).toEqual(all(false));
      expect(await answers('owner', deleted)).toEqual(all(false));
    });

    it('a record that does not exist is read by nobody', async () => {
      const missing = { PETITION: `${tag}-none`, INCIDENT: `${tag}-none`, CASE: `${tag}-none` };
      expect(await answers('admin', missing)).toEqual(all(false));
      expect(await routeAnswers('admin', missing)).toEqual(all(false));
    });

    it('a locked account reads nothing', async () => {
      await scratch.db.user.update({ where: { id: id.member }, data: { isActive: false } });
      try {
        expect(await answers('member')).toEqual(all(false));
      } finally {
        await scratch.db.user.update({ where: { id: id.member }, data: { isActive: true } });
      }
    });
  });

  describe('canRead, permissions by team ENFORCED', () => {
    beforeAll(() => switchTo('ENFORCE'));
    afterAll(() => switchTo('OFF'));

    it('permissions by team are enforced', () => {
      expect(authz.state()).toBe('ENFORCE');
    });

    it('(a) the owner, whose own team sets nothing, still reads their records in another team', async () => {
      expect(await answers('owner')).toEqual(all(true));
      expect(await routeAnswers('owner')).toEqual(all(true));
    });

    it('(b) a member of the assigned team reads what the team gives: its incidents and cases, but only petitions they entered', async () => {
      const expected = { PETITION: false, INCIDENT: true, CASE: true };
      expect(await answers('member')).toEqual(expected);
      expect(await routeAnswers('member')).toEqual(expected);
    });

    it('(c) an officer of another team does not', async () => {
      expect(await answers('other')).toEqual(all(false));
      expect(await routeAnswers('other')).toEqual(all(false));
    });

    it('(d) an administrator reads it', async () => {
      expect(await answers('admin')).toEqual(all(true));
      expect(await routeAnswers('admin')).toEqual(all(true));
    });

    it('a deleted record is still read by nobody', async () => {
      expect(await answers('admin', deleted)).toEqual(all(false));
      expect(await routeAnswers('admin', deleted)).toEqual(all(false));
    });
  });

  describe('load', () => {
    const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
    const none = { at: null, hasTime: false };

    it('a petition, with the time it was received', async () => {
      expect(await gateway.load('PETITION', record.PETITION)).toEqual({
        kind: 'PETITION',
        id: record.PETITION,
        code: `${tag}-p`,
        informationType: 'Tố cáo',
        assignedTeamId: id.T,
        ownerUserId: id.assignee,
        status: 'DANG_XU_LY',
        isFinished: false,
        isSuspended: false,
        deadline: day('2026-02-04'),
        anchors: {
          RECEIVED: { at: new Date('2026-01-05T02:30:00.000Z'), hasTime: true },
          PROPOSED: { at: day('2026-01-06'), hasTime: false },
          ASSIGNED_TO_UNIT: { at: day('2026-01-07'), hasTime: false },
          ACCEPTED: none,
          PROSECUTED: none,
        },
      });
    });

    it('a suspended incident', async () => {
      expect(await gateway.load('INCIDENT', record.INCIDENT)).toEqual({
        kind: 'INCIDENT',
        id: record.INCIDENT,
        code: `${tag}-i`,
        informationType: 'Tố giác',
        assignedTeamId: id.T,
        ownerUserId: id.owner,
        status: 'TAM_DINH_CHI',
        isFinished: false,
        isSuspended: true,
        deadline: null,
        anchors: {
          RECEIVED: { at: day('2026-01-02'), hasTime: false },
          PROPOSED: { at: day('2026-01-05'), hasTime: false },
          ASSIGNED_TO_UNIT: none,
          ACCEPTED: none,
          PROSECUTED: none,
        },
      });
    });

    it('a concluded case, received on the date it was taken in when the minutes carry none', async () => {
      expect(await gateway.load('CASE', record.CASE)).toEqual({
        kind: 'CASE',
        id: record.CASE,
        code: `${tag}-c`,
        informationType: null,
        assignedTeamId: id.T,
        ownerUserId: id.owner,
        status: 'DA_KET_LUAN',
        isFinished: true,
        isSuspended: false,
        deadline: null,
        anchors: {
          RECEIVED: { at: day('2026-01-08'), hasTime: false },
          PROPOSED: none,
          ASSIGNED_TO_UNIT: none,
          ACCEPTED: none,
          PROSECUTED: { at: day('2026-02-01'), hasTime: false },
        },
      });
    });

    it.each(KINDS)('%s: a deleted record and a record that does not exist load as nothing', async (kind) => {
      expect(await gateway.load(kind, deleted[kind])).toBeNull();
      expect(await gateway.load(kind, `${tag}-none`)).toBeNull();
    });

    it('inside a transaction it reads what that transaction wrote, and nothing is left when it rolls back', async () => {
      const rollback = new Error('rollback');
      let seenInside: Date | null | undefined;
      await expect(
        scratch.db.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.incident.update({ where: { id: record.INCIDENT }, data: { deadline: new Date('2026-12-31T00:00:00Z') } });
          seenInside = (await gateway.load('INCIDENT', record.INCIDENT, tx))?.deadline;
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(seenInside).toEqual(day('2026-12-31'));
      expect((await gateway.load('INCIDENT', record.INCIDENT))?.deadline).toBeNull();
    });

    it('loading does not write: the record is the same row afterwards', async () => {
      const before = await scratch.db.petition.findUniqueOrThrow({ where: { id: record.PETITION } });
      await gateway.load('PETITION', record.PETITION);
      await gateway.canRead('PETITION', record.PETITION, user('owner'));
      expect(await scratch.db.petition.findUniqueOrThrow({ where: { id: record.PETITION } })).toEqual(before);
    });
  });
});
