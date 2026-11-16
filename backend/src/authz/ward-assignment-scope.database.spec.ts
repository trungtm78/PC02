import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../common/testing/install-trigger-section';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { recordInActionScope, recordInScope } from '../common/utils/scope-filter.util';
import { STARTER_TEMPLATES, starterTemplates } from './admin/starter-templates';
import { AuthzService } from './authz.service';
import { AuthzScopeService } from './authz-scope.service';
import { setEnforcement } from './enforcement';
import { readersOf } from './record-readers';

/**
 * The fourth record subject (a ward unit's request for an assignment) under permissions by team ENFORCED, from the
 * stored templates to the answers, on a real PostgreSQL: the configuration tables and their triggers, `AuthzService`
 * loading them, the registered `AuthzScopeService`, the record helpers and the readers of a notice.
 *
 * The two templates are the starter templates as the code builds them ("Phường/xã: trình phân công", "PC02: thẩm
 * định phân công"), stored as rows. Expected values come from the owner's decisions of 16/11/2026, not from running
 * the code:
 *   a ward officer sees and changes the requests of their own ward unit only, and decides none;
 *   a reviewer of PC02 sees and decides every ward unit's request, and edits none;
 *   a dispatcher of PC02 is given nothing about ward requests by being a dispatcher;
 *   a notice about a request reaches only people who may open it.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('ward assignments under permissions by team, end to end on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let db: PrismaClient;
  let pg: Client;
  let authz: AuthzService;
  let scopes: AuthzScopeService;
  const tag = `wa-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};

  /** The real client, except that the mode row says ENFORCE (the scratch database is shared; it is not written). */
  const enforced = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) =>
              args.where.key === SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO
                ? Promise.resolve({ key: args.where.key, value: 'ENFORCE' })
                : setting.findUnique(args as never);
          },
        });
      },
    });

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    // The templates exactly as the starter button would make them.
    const docs = starterTemplates([]);
    const perm: Record<string, string> = {};
    for (const key of new Set([...Object.keys(docs.STARTER_WARD_SUBMIT.entries), ...Object.keys(docs.STARTER_WARD_REVIEW.entries)])) {
      const [action, subject] = key.split(':');
      perm[key] = (await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } })).id;
    }
    // The role holds nothing about ward requests: only a team gives that.
    id.role = (await db.role.create({ data: { name: `${tag}-officer` } })).id;
    for (const name of ['wardy', 'wardMate', 'otherWard', 'bothWards', 'reviewer', 'twoUnits', 'dispatcher']) {
      id[name] = (
        await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: id.role, isActive: true, canDispatch: name === 'dispatcher' } })
      ).id;
    }
    const ward = async (key: string) => (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: `${tag} ${key}` } })).id;
    id.W = (await db.team.create({ data: { code: `${tag}-W`, name: `${tag} CAP Vườn Lài`, wardId: await ward('w') } })).id;
    id.V = (await db.team.create({ data: { code: `${tag}-V`, name: `${tag} CAP Tân Định`, wardId: await ward('v') } })).id;
    id.P = (await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Đội 1 PC02` } })).id;
    id.D = (await db.team.create({ data: { code: `${tag}-D`, name: `${tag} Điều phối` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.wardy, teamId: id.W },
        { userId: id.wardMate, teamId: id.W },
        { userId: id.otherWard, teamId: id.V },
        { userId: id.bothWards, teamId: id.W },
        { userId: id.bothWards, teamId: id.V },
        { userId: id.reviewer, teamId: id.P },
        { userId: id.twoUnits, teamId: id.W },
        { userId: id.twoUnits, teamId: id.P },
        { userId: id.dispatcher, teamId: id.D },
      ],
    });
    const template = async (code: 'STARTER_WARD_SUBMIT' | 'STARTER_WARD_REVIEW') =>
      (
        await db.permissionTemplate.create({
          data: {
            code: `${tag}-${code}`,
            name: `${tag} ${STARTER_TEMPLATES.find((t) => t.code === code)!.name}`,
            entries: { create: Object.entries(docs[code].entries).map(([key, reach]) => ({ permissionId: perm[key], reach })) },
          },
        })
      ).id;
    id.submitTpl = await template('STARTER_WARD_SUBMIT');
    id.reviewTpl = await template('STARTER_WARD_REVIEW');
    await db.teamPermissionConfig.createMany({
      data: [
        { teamId: id.W, mode: 'EXPLICIT', memberTemplateId: id.submitTpl, leaderTemplateId: id.submitTpl },
        { teamId: id.V, mode: 'EXPLICIT', memberTemplateId: id.submitTpl, leaderTemplateId: id.submitTpl },
        { teamId: id.P, mode: 'EXPLICIT', memberTemplateId: id.reviewTpl, leaderTemplateId: id.reviewTpl },
      ],
    });

    AuthzService.enforceAvailable = true;
    authz = new AuthzService(enforced(db) as never);
    scopes = new AuthzScopeService(authz);
    await authz.refresh();
    scopes.onApplicationBootstrap();
  });

  afterAll(async () => {
    scopes?.onModuleDestroy();
    setEnforcement(null);
    AuthzService.enforceAvailable = false;
    authz?.onModuleDestroy();
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  // Requests of ward W (one entered by a colleague of the ward, one entered by PC02 on its behalf) and of ward V.
  const OF_W = () => ({ assignedTeamId: id.W, ownerId: id.wardMate });
  const OF_W_BY_PC02 = () => ({ assignedTeamId: id.W, ownerId: id.reviewer });
  const OF_V = () => ({ assignedTeamId: id.V, ownerId: id.otherWard });
  // Entered for ward V by somebody who sits in BOTH wards.
  const OF_V_BY_BOTH = () => ({ assignedTeamId: id.V, ownerId: id.bothWards });
  const sees = (who: string, record: { assignedTeamId: string; ownerId: string }, op: 'read' | 'write') =>
    recordInScope(record, scopes.scopeOf(id[who]), op, 'WardAssignment');
  const decides = (who: string, record: { assignedTeamId: string; ownerId: string }) =>
    recordInActionScope(record, scopes.scopeOf(id[who]), 'WardAssignment', 'review');

  it('a ward officer sees and changes the requests of their own ward unit, whoever entered them, and no other ward', () => {
    expect(scopes.keysOf(id.wardy)).toEqual(['delete:WardAssignment', 'edit:WardAssignment', 'read:WardAssignment', 'write:WardAssignment']);
    expect(sees('wardy', OF_W(), 'read')).toBe(true);
    expect(sees('wardy', OF_W(), 'write')).toBe(true);
    expect(sees('wardy', OF_W_BY_PC02(), 'read')).toBe(true);
    expect(sees('wardy', OF_V(), 'read')).toBe(false);
    expect(sees('wardy', OF_V(), 'write')).toBe(false);
  });

  it('a request entered for ward V by somebody of both wards stays with V: nobody of W alone reaches it', () => {
    expect(sees('wardy', OF_V_BY_BOTH(), 'read')).toBe(false);
    expect(sees('wardy', OF_V_BY_BOTH(), 'write')).toBe(false);
    expect(sees('bothWards', OF_V_BY_BOTH(), 'write')).toBe(true);
    expect(sees('otherWard', OF_V_BY_BOTH(), 'read')).toBe(true);
    const told = readersOf([id.wardy, id.wardMate, id.otherWard, id.bothWards], 'WardAssignment', OF_V_BY_BOTH());
    expect(told.sort()).toEqual([id.otherWard, id.bothWards].sort());
  });

  it('a ward officer decides no request, not even their own unit\'s', () => {
    expect(decides('wardy', OF_W())).toBe(false);
    expect(decides('wardy', OF_V())).toBe(false);
  });

  it('a reviewer of PC02 sees and decides every ward unit\'s request, and edits none', () => {
    expect(scopes.keysOf(id.reviewer)).toEqual(['matchSubjects:WardAssignment', 'read:WardAssignment', 'review:WardAssignment']);
    for (const record of [OF_W(), OF_V()]) {
      expect(sees('reviewer', record, 'read')).toBe(true);
      expect(decides('reviewer', record)).toBe(true);
      expect(sees('reviewer', record, 'write')).toBe(false);
    }
  });

  it('a person in a ward unit and in PC02 holds the union: changes their ward\'s requests, sees and decides every one', () => {
    // Whether they may decide a request of their OWN ward is the command's rule (segregation of duties), not reach.
    expect(sees('twoUnits', OF_W(), 'write')).toBe(true);
    expect(sees('twoUnits', OF_V(), 'write')).toBe(false);
    expect(decides('twoUnits', OF_V())).toBe(true);
  });

  it('a dispatcher of PC02 gets nothing about ward requests by being a dispatcher', () => {
    expect(scopes.keysOf(id.dispatcher)).toEqual([]);
    expect(sees('dispatcher', OF_W(), 'read')).toBe(false);
    expect(decides('dispatcher', OF_W())).toBe(false);
  });

  it('a notice about a request of ward W reaches its ward and the reviewers, nobody else', () => {
    const told = readersOf([id.wardy, id.wardMate, id.otherWard, id.bothWards, id.reviewer, id.twoUnits, id.dispatcher], 'WardAssignment', OF_W());
    expect(told.sort()).toEqual([id.wardy, id.wardMate, id.bothWards, id.reviewer, id.twoUnits].sort());
  });
});
