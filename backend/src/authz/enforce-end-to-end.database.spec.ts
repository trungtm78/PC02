// AuthService pulls in the 2FA chain (otplib, qrcode: ESM only). The mock shapes MUST be exactly those of
// `app.bootstrap.spec.ts` / `two-fa.service.spec.ts`: suites share a worker's module registry, and a different shape
// here would leak into the 2FA suite and fail it.
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../common/testing/install-trigger-section';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthService } from '../auth/auth.service';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { buildPetitionScopeFilter } from '../common/utils/scope-filter.util';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { AuthzService, MAX_SNAPSHOT_AGE_MS } from './authz.service';
import { AuthzScopeService } from './authz-scope.service';
import { enforcement, holdsPermission, setEnforcement, userHoldingPermission } from './enforcement';

/**
 * Permissions by team ENFORCED, from the stored configuration to the rows a person gets, on a REAL PostgreSQL.
 *
 * Everything is the real thing: the configuration tables and their triggers, `AuthzService` loading them, the
 * registered `AuthzScopeService`, the route guard, `/auth/me`, the request scope and the record filter run as a
 * query. One thing is substituted: the MODE row is read through a wrapper that answers what this suite says. The
 * scratch database is shared by every database suite, and writing ENFORCE into it would switch the others over.
 *
 * Expected values come from the specification of the four reaches, not from running the code:
 *   OWN        records the person entered; never unassigned ones;
 *   TEAM       records assigned to exactly the team that gives the permission; never unassigned ones;
 *   TEAM_TREE  the team, the teams under it, records of its people, and unassigned records (as before);
 *   nothing configured up the line: what the ROLE holds, at TEAM_TREE.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('permissions by team enforced, end to end on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let db: PrismaClient;
  let pg: Client;
  let authz: AuthzService;
  let scopes: AuthzScopeService;
  let mode: 'OFF' | 'SHADOW' | 'ENFORCE' = 'ENFORCE';
  const tag = `e2e-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const perm: Record<string, string> = {};
  const REVIEW = 'review_reset_request:EditWindowResetRequest';

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
    // The mode is part of the snapshot, and a snapshot is rebuilt when the change log moved. In production the
    // trigger on the settings row logs the change of mode; here that row is not written, so something logged is.
    const bump = await db.team.create({ data: { code: `${tag}-bump-${randomUUID().slice(0, 6)}`, name: `${tag} bump` } });
    await db.team.delete({ where: { id: bump.id } });
    await authz.refresh();
  };

  const petition = (name: string, enteredById: string | null, assignedTeamId: string | null) =>
    db.petition.create({
      data: { stt: `${tag}-${name}`, receivedDate: new Date('2026-01-05T00:00:00Z'), senderName: name, enteredById, assignedTeamId } as never,
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

    for (const key of ['read:Petition', 'edit:Petition', 'delete:Petition', 'read:Case', REVIEW]) {
      const [action, subject] = key.split(':');
      const row = await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } });
      perm[key] = row.id;
    }
    // The role holds everything but the review permission: only a team gives that one.
    id.role = (
      await db.role.create({
        data: {
          name: `${tag}-officer`,
          permissions: { create: ['read:Petition', 'edit:Petition', 'delete:Petition', 'read:Case'].map((p) => ({ permissionId: perm[p] })) },
        },
      })
    ).id;
    for (const name of ['member', 'leader', 'junior', 'outsider']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: id.role, isActive: true } })).id;
    }
    // T (configured) with T1 under it; U has nothing configured anywhere up its line.
    id.T = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ T` } })).id;
    id.T1 = (await db.team.create({ data: { code: `${tag}-T1`, name: `${tag} Tổ T1`, parentId: id.T } })).id;
    id.U = (await db.team.create({ data: { code: `${tag}-U`, name: `${tag} Tổ U` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.member, teamId: id.T },
        { userId: id.leader, teamId: id.T, isLeader: true },
        { userId: id.junior, teamId: id.T1 },
        { userId: id.outsider, teamId: id.U },
      ],
    });
    id.memberTpl = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-m`,
          name: `${tag} Own records only`,
          entries: { create: [{ permissionId: perm['read:Petition'], reach: 'OWN' }, { permissionId: perm['edit:Petition'], reach: 'OWN' }] },
        },
      })
    ).id;
    id.leaderTpl = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-l`,
          name: `${tag} Team lead`,
          entries: {
            create: [
              { permissionId: perm['read:Petition'], reach: 'TEAM_TREE' },
              { permissionId: perm['edit:Petition'], reach: 'TEAM' },
              { permissionId: perm['delete:Petition'], reach: 'TEAM' },
              // Not about records: such a permission is held or not (ALL), it has no reach to a team.
              { permissionId: perm[REVIEW], reach: 'ALL' },
            ],
          },
        },
      })
    ).id;
    await db.teamPermissionConfig.create({
      data: { teamId: id.T, mode: 'EXPLICIT', memberTemplateId: id.memberTpl, leaderTemplateId: id.leaderTpl },
    });

    await petition('by-member-in-T', id.member, id.T);
    await petition('by-leader-in-T', id.leader, id.T);
    await petition('by-junior-in-T1', id.junior, id.T1);
    await petition('by-outsider-in-U', id.outsider, id.U);
    await petition('by-member-unassigned', id.member, null);
    await petition('nobody-unassigned', null, null);

    AuthzService.enforceAvailable = true;
    authz = new AuthzService(withMode(db) as never);
    scopes = new AuthzScopeService(authz);
    await authz.refresh();
    scopes.onApplicationBootstrap();
  });

  afterAll(async () => {
    scopes?.onModuleDestroy();
    setEnforcement(null);
    AuthzService.enforceAvailable = false;
    authz?.onModuleDestroy();
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
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

  // ── the pieces of the request path, each the real class on the real database ────────────────────────────────────
  const guardAllows = async (who: string, action: string, subject: string): Promise<boolean> => {
    const context = {
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({ getRequest: () => ({ user: { id: id[who], roleId: id.role } }) }),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: (key: string) => (key === PERMISSIONS_KEY ? [{ action, subject }] : undefined),
    } as unknown as Reflector;
    try {
      return await new PermissionsGuard(reflector, db as never).canActivate(context);
    } catch {
      return false;
    }
  };
  const profilePermissions = async (who: string): Promise<string[]> => {
    const service = Object.assign(Object.create(AuthService.prototype) as object, { prisma: db }) as unknown as AuthService;
    return [...(await service.getProfile(id[who])).permissions].sort();
  };
  /** The scope the interceptor puts on the request. Team lookups are not needed when enforced; refusing them proves it. */
  const requestScope = (who: string, teams: unknown = new Proxy({}, { get: () => () => Promise.reject(new Error('the role path was taken')) })) =>
    new UnitScopeService(db as never, teams as never).resolveScope(id[who], `${tag}-officer`, false);
  /** The petitions of this suite that the person's scope lets through, by the query the list endpoints run. */
  const petitionsFor = async (who: string, op: 'read' | 'write'): Promise<string[]> => {
    const filter = buildPetitionScopeFilter(await requestScope(who), op);
    const rows = await db.petition.findMany({
      where: { AND: [{ stt: { startsWith: tag } }, ...(filter ? [filter] : [])] },
      select: { senderName: true },
    });
    return rows.map((r) => r.senderName).sort();
  };

  it('the enforcement of the process is the registered service, answering from the stored configuration', () => {
    expect(enforcement()).toBe(scopes);
    expect(authz.state()).toBe('ENFORCE');
  });

  describe('what a person may do (route guard and /auth/me agree)', () => {
    it('a member of a configured team holds what the member template gives, not what the role holds', async () => {
      expect(await profilePermissions('member')).toEqual(['edit:Petition', 'read:Petition']);
      expect(await guardAllows('member', 'read', 'Petition')).toBe(true);
      expect(await guardAllows('member', 'edit', 'Petition')).toBe(true);
      // The role has both of these; the template does not.
      expect(await guardAllows('member', 'delete', 'Petition')).toBe(false);
      expect(await guardAllows('member', 'read', 'Case')).toBe(false);
    });

    it('the leader of that team holds the leader template, including a permission no role carries', async () => {
      expect(await profilePermissions('leader')).toEqual(['delete:Petition', 'edit:Petition', 'read:Petition', REVIEW].sort());
      expect(await guardAllows('leader', 'delete', 'Petition')).toBe(true);
      expect(await guardAllows('leader', 'review_reset_request', 'EditWindowResetRequest')).toBe(true);
    });

    it('a team that sets nothing inherits its parent: the member of T1 gets the member template of T', async () => {
      expect(await profilePermissions('junior')).toEqual(['edit:Petition', 'read:Petition']);
      expect(await guardAllows('junior', 'delete', 'Petition')).toBe(false);
    });

    it('with nothing configured up the line, a person keeps what the role holds', async () => {
      expect(await profilePermissions('outsider')).toEqual(['delete:Petition', 'edit:Petition', 'read:Case', 'read:Petition']);
      expect(await guardAllows('outsider', 'delete', 'Petition')).toBe(true);
      expect(await guardAllows('outsider', 'review_reset_request', 'EditWindowResetRequest')).toBe(false);
    });

    it('code that checks a permission itself gets the same answer, and the role is not consulted', () => {
      const fromRole = jest.fn().mockReturnValue(true);
      expect(holdsPermission(id.member, 'delete:Petition', fromRole)).toBe(false);
      expect(holdsPermission(id.leader, REVIEW, fromRole)).toBe(true);
      expect(fromRole).not.toHaveBeenCalled();
    });

    it('the people who hold a permission are found as people, whatever their role', async () => {
      const where = userHoldingPermission('review_reset_request', 'EditWindowResetRequest');
      const holders = await db.user.findMany({ where: { AND: [{ username: { startsWith: tag } }, where] }, select: { id: true } });
      expect(holders.map((h) => h.id)).toEqual([id.leader]);
    });
  });

  describe('which records a person gets (the list query, run)', () => {
    it('OWN: the records the member entered, in a team or not, and nothing else', async () => {
      expect(await petitionsFor('member', 'read')).toEqual(['by-member-in-T', 'by-member-unassigned']);
      expect(await petitionsFor('member', 'write')).toEqual(['by-member-in-T', 'by-member-unassigned']);
    });

    it('TEAM_TREE to read: the team, the team under it, and unassigned records; not another team', async () => {
      expect(await petitionsFor('leader', 'read')).toEqual([
        'by-junior-in-T1',
        'by-leader-in-T',
        'by-member-in-T',
        'by-member-unassigned',
        'nobody-unassigned',
      ]);
    });

    it('TEAM to change: exactly the team that gives it; not the team under it, not unassigned records', async () => {
      expect(await petitionsFor('leader', 'write')).toEqual(['by-leader-in-T', 'by-member-in-T']);
    });

    it('nothing configured: the role at TEAM_TREE, as before (own team and unassigned records)', async () => {
      expect(await petitionsFor('outsider', 'read')).toEqual(['by-member-unassigned', 'by-outsider-in-U', 'nobody-unassigned']);
    });

    it('a service built by hand gets the very scope the request gets', async () => {
      const actor = { id: id.member, canDispatch: false, role: { name: `${tag}-officer`, permissions: [] } };
      const fromGovernance = await new CaseGovernanceService(db as never).currentScope(db as never, actor as never);
      expect(fromGovernance).toEqual(await requestScope('member'));
    });
  });

  describe('a change of the configuration reaches the request path by itself', () => {
    it('an override that mutes a permission for one person takes it away; removing it gives it back', async () => {
      expect(await guardAllows('leader', 'delete', 'Petition')).toBe(true);
      const override = await db.userPermissionOverride.create({
        data: { userId: id.leader, permissionId: perm['delete:Petition'], effect: 'MUTE', reason: `${tag} test` } as never,
      });
      await authz.refresh();
      expect(await guardAllows('leader', 'delete', 'Petition')).toBe(false);
      expect(await profilePermissions('leader')).not.toContain('delete:Petition');
      await db.userPermissionOverride.delete({ where: { id: override.id } });
      await authz.refresh();
      expect(await guardAllows('leader', 'delete', 'Petition')).toBe(true);
    });
  });

  describe('when the configuration cannot be trusted, nothing is decided from the role', () => {
    it('a configuration confirmed too long ago refuses the question instead of answering from the role', () => {
      const tooLate = new Date(Date.now() + MAX_SNAPSHOT_AGE_MS + 60_000);
      expect(() => scopes.keysOf(id.member, tooLate)).toThrow(expect.objectContaining({ response: { code: 'AUTHZ_UNAVAILABLE' } }));
      expect(() => scopes.scopeOf(id.member, tooLate)).toThrow(expect.objectContaining({ response: { code: 'AUTHZ_UNAVAILABLE' } }));
    });
  });

  describe('rollback: the mode set back to OFF', () => {
    it('everybody is back on the role, at once after the next refresh', async () => {
      await switchTo('OFF');
      try {
        expect(authz.state()).toBe('OFF');
        expect(enforcement()!.keysOf(id.member)).toBeUndefined();
        // The role holds delete: the member has it again; the leader loses what only the team gave.
        expect(await guardAllows('member', 'delete', 'Petition')).toBe(true);
        expect(await guardAllows('leader', 'review_reset_request', 'EditWindowResetRequest')).toBe(false);
        expect(await profilePermissions('member')).toEqual(['delete:Petition', 'edit:Petition', 'read:Case', 'read:Petition']);
        // And the scope is resolved from the teams again (the lookups that were refused above are used now).
        const teams = {
          getDescendantIds: (teamId: string) => Promise.resolve(teamId === id.T ? [id.T1] : []),
          getUserIdsForTeams: (teamIds: string[]) =>
            db.userTeam.findMany({ where: { teamId: { in: teamIds } }, select: { userId: true } }).then((rows) => rows.map((r) => r.userId)),
        };
        const scope = await requestScope('member', teams);
        expect(scope).not.toHaveProperty('precise');
        expect([...scope!.teamIds].sort()).toEqual([id.T, id.T1].sort());
      } finally {
        await switchTo('ENFORCE');
      }
      expect(await guardAllows('member', 'delete', 'Petition')).toBe(false);
    });

    it('SHADOW enforces nothing either', async () => {
      await switchTo('SHADOW');
      try {
        expect(enforcement()!.keysOf(id.member)).toBeUndefined();
        expect(await guardAllows('member', 'delete', 'Petition')).toBe(true);
      } finally {
        await switchTo('ENFORCE');
      }
    });
  });
});
