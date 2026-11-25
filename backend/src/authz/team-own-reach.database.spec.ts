// AuthService is not imported here, but UnitScopeService pulls the auth module's graph in some setups: keep the same
// 2FA mock shapes as `enforce-end-to-end.database.spec.ts` (suites share a worker's module registry).
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../common/testing/install-trigger-section';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { buildPetitionScopeFilter, buildScopeFilter } from '../common/utils/scope-filter.util';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { AuthzService } from './authz.service';
import { AuthzScopeService } from './authz-scope.service';
import { setEnforcement } from './enforcement';

/**
 * TEAM_OWN ("Đúng tổ + của mình") ENFORCED, from the stored template to the rows the list query returns, on a real
 * PostgreSQL. Expected values come from the specification of the reach, not from running the code:
 *   records assigned to exactly the team that gives it, and records the person owns wherever they are (also with no
 *   team); never a team under it, never another team's, never another person's unassigned records.
 * The people of the other team (no configuration: the role "as today") keep exactly what they had.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('TEAM_OWN enforced, end to end on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let db: PrismaClient;
  let pg: Client;
  let authz: AuthzService;
  let scopes: AuthzScopeService;
  const tag = `to-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};

  const withEnforce = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) =>
              args.where.key === SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO ? Promise.resolve({ key: args.where.key, value: 'ENFORCE' }) : setting.findUnique(args as never);
          },
        });
      },
    });

  const petition = (name: string, enteredById: string | null, assignedTeamId: string | null) =>
    db.petition.create({ data: { stt: `${tag}-${name}`, receivedDate: new Date('2026-01-05T00:00:00Z'), senderName: name, enteredById, assignedTeamId } as never });
  const incident = (name: string, investigatorId: string | null, assignedTeamId: string | null) =>
    db.incident.create({ data: { code: `${tag}-${name}`, name, investigatorId, assignedTeamId } as never });

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test', '/pc02_unit_chart_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    const perm: Record<string, string> = {};
    for (const key of ['read:Petition', 'edit:Petition', 'read:Incident']) {
      const [action, subject] = key.split(':');
      perm[key] = (await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } })).id;
    }
    id.role = (await db.role.create({ data: { name: `${tag}-officer`, permissions: { create: Object.values(perm).map((permissionId) => ({ permissionId })) } } })).id;
    for (const name of ['officer', 'mate', 'other', 'stranger']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: id.role, isActive: true } })).id;
    }
    // A (TEAM_OWN for its members), A1 under A, B with nothing configured.
    id.A = (await db.team.create({ data: { code: `${tag}-A`, name: `${tag} A` } })).id;
    id.A1 = (await db.team.create({ data: { code: `${tag}-A1`, name: `${tag} A1`, parentId: id.A } })).id;
    id.B = (await db.team.create({ data: { code: `${tag}-B`, name: `${tag} B` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.officer, teamId: id.A },
        { userId: id.mate, teamId: id.A },
        { userId: id.other, teamId: id.B },
      ],
    });
    id.tpl = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-tpl`,
          name: `${tag} Team only`,
          entries: { create: Object.values(perm).map((permissionId) => ({ permissionId, reach: 'TEAM_OWN' as const })) },
        },
      })
    ).id;
    // A1 has nothing of its own: it follows A, measured from A1 itself, so A's members still do not reach it.
    await db.teamPermissionConfig.create({ data: { teamId: id.A, mode: 'EXPLICIT', memberTemplateId: id.tpl } });

    await petition('in-A-by-mate', id.mate, id.A);
    await petition('in-A-by-nobody', null, id.A);
    await petition('in-A1-by-stranger', id.stranger, id.A1);
    await petition('in-B-by-officer', id.officer, id.B);
    await petition('in-B-by-other', id.other, id.B);
    await petition('unassigned-by-officer', id.officer, null);
    await petition('unassigned-by-mate', id.mate, null);
    await petition('unassigned-by-nobody', null, null);
    await incident('i-in-A', null, id.A);
    await incident('i-unassigned-mine', id.officer, null);
    await incident('i-unassigned-other', id.other, null);

    AuthzService.enforceAvailable = true;
    authz = new AuthzService(withEnforce(db) as never);
    scopes = new AuthzScopeService(authz);
    await authz.refresh();
    scopes.onApplicationBootstrap();
  });

  afterAll(async () => {
    scopes?.onModuleDestroy();
    setEnforcement(null);
    authz?.onModuleDestroy();
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag }, parentId: { not: null } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  const scopeOf = (who: string) =>
    new UnitScopeService(db as never, new Proxy({}, { get: () => () => Promise.reject(new Error('the role path was taken')) }) as never).resolveScope(id[who], `${tag}-officer`, false);
  const petitionsFor = async (who: string, op: 'read' | 'write') => {
    const filter = buildPetitionScopeFilter(await scopeOf(who), op);
    const rows = await db.petition.findMany({ where: { AND: [{ stt: { startsWith: tag } }, ...(filter ? [filter] : [])] }, select: { senderName: true } });
    return rows.map((r) => r.senderName).sort();
  };
  const incidentsFor = async (who: string) => {
    const filter = buildScopeFilter(await scopeOf(who), 'read', 'Incident');
    const rows = await db.incident.findMany({ where: { AND: [{ code: { startsWith: tag } }, ...(filter ? [filter] : [])] }, select: { name: true } });
    return rows.map((r) => r.name).sort();
  };

  it('a member with TEAM_OWN sees exactly the team\'s records and their own, wherever they are', async () => {
    expect(await petitionsFor('officer', 'read')).toEqual(['in-A-by-mate', 'in-A-by-nobody', 'in-B-by-officer', 'unassigned-by-officer']);
    expect(await petitionsFor('officer', 'write')).toEqual(['in-A-by-mate', 'in-A-by-nobody', 'in-B-by-officer', 'unassigned-by-officer']);
    expect(await incidentsFor('officer')).toEqual(['i-in-A', 'i-unassigned-mine']);
  });

  it('never another member\'s unassigned record, never the team below, never another team\'s record', async () => {
    const seen = await petitionsFor('mate', 'read');
    expect(seen).toEqual(['in-A-by-mate', 'in-A-by-nobody', 'unassigned-by-mate']);
    expect(seen).not.toContain('unassigned-by-officer');
    expect(seen).not.toContain('in-A1-by-stranger');
    expect(seen).not.toContain('in-B-by-other');
  });

  it('somebody without TEAM_OWN keeps exactly today\'s scope: the role over the whole team, its people, unassigned', async () => {
    expect(await petitionsFor('other', 'read')).toEqual(['in-B-by-officer', 'in-B-by-other', 'unassigned-by-mate', 'unassigned-by-nobody', 'unassigned-by-officer']);
  });
});
