import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../../common/testing/install-trigger-section';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { AuthzService } from '../authz.service';
import { AUTHZ_MODE_ERROR, AuthzModeService, MODE_REQUEST_TTL_MS } from './authz-mode.service';

/**
 * Switching permissions by team on and off, on a REAL PostgreSQL: the comparison of who gains and loses what, the
 * two administrators enforcing needs, what refuses it, and the one-step way back.
 *
 * The mode row and the administrator role are shared by every suite on the scratch database: this suite leaves the
 * mode as it found it, and never leaves ENFORCE behind.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('AuthzModeService on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let db: PrismaClient;
  let pg: Client;
  let authz: AuthzService;
  let service: AuthzModeService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `am-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const perm: Record<string, string> = {};
  let modeBefore: string | null = null;
  const grantedToAdminHere: string[] = [];

  const stored = async () => (await db.systemSetting.findUnique({ where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO } }))?.value ?? null;
  const code = (expected: string) => expect.objectContaining({ response: expect.objectContaining({ code: expected }) });
  const mine = () => db.authzModeChange.findMany({ where: { requestedById: { in: [id.adminA, id.adminB] } }, orderBy: { createdAt: 'asc' } });
  /**
   * Other suites write to the same scratch database while the whole suite runs in parallel: the comparison can move
   * between reading it and acting on it. That is the refusal `COMPARISON_CHANGED`, and the answer is the one the
   * screen gives: read again, act again.
   */
  async function onFreshComparison<T>(act: (fingerprint: string) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const { fingerprint } = await service.comparison();
      try {
        return await act(fingerprint);
      } catch (err) {
        const changed = (err as { response?: { code?: string } }).response?.code === AUTHZ_MODE_ERROR.COMPARISON_CHANGED;
        if (!changed || attempt >= 60) throw err;
      }
    }
  }
  const backToOff = async () => {
    await db.authzModeChange.updateMany({ where: { status: 'PENDING', requestedById: { in: [id.adminA, id.adminB] } }, data: { status: 'WITHDRAWN' } });
    // No row at all is OFF too. Another suite rewrites the mode row to test its trigger: "already OFF" is fine.
    if (((await stored()) ?? 'OFF') === 'OFF') return;
    await service.set(id.adminA, 'OFF', `${tag} reset`).catch((err: { response?: { code?: string } }) => {
      if (err.response?.code !== AUTHZ_MODE_ERROR.ALREADY) throw err;
    });
  };

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    // The mode row exists once for the whole database: the suites that write it take turns.
    await takeTurnOnSharedRow(pg, 'authz-mode');
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');
    modeBefore = await stored();

    for (const key of ['read:Role', 'write:Role', 'read:Petition', 'delete:Petition']) {
      const [action, subject] = key.split(':');
      perm[key] = (await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } })).id;
    }
    // The administrator role is the real one (the engine knows it by name). It must hold what administering needs.
    const adminRole = await db.role.upsert({ where: { name: ROLE_NAMES.ADMIN }, update: {}, create: { name: ROLE_NAMES.ADMIN } });
    id.adminRole = adminRole.id;
    for (const key of ['read:Role', 'write:Role']) {
      const where = { roleId_permissionId: { roleId: adminRole.id, permissionId: perm[key] } };
      if (!(await db.rolePermission.findUnique({ where }))) {
        await db.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm[key] } });
        grantedToAdminHere.push(perm[key]);
      }
    }
    id.officerRole = (
      await db.role.create({
        data: { name: `${tag}-officer`, permissions: { create: ['read:Petition', 'delete:Petition', 'write:Role', 'read:Role'].map((p) => ({ permissionId: perm[p] })) } },
      })
    ).id;
    for (const [name, roleId] of [['adminA', adminRole.id], ['adminB', adminRole.id], ['officer', id.officerRole]] as const) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId, isActive: true } })).id;
    }
    id.team = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ T` } })).id;
    await db.userTeam.create({ data: { userId: id.officer, teamId: id.team } });
    // The team gives its members less than the role holds: enforcing takes `delete:Petition` (and the role
    // administration) away from the officer.
    id.template = (
      await db.permissionTemplate.create({
        data: { code: `${tag}-m`, name: `${tag} View only`, entries: { create: [{ permissionId: perm['read:Petition'], reach: 'OWN' }] } },
      })
    ).id;
    await db.teamPermissionConfig.create({ data: { teamId: id.team, mode: 'EXPLICIT', memberTemplateId: id.template } });

    authz = new AuthzService(db as never);
    service = new AuthzModeService(db as never, authz, audit as never);
  });

  afterAll(async () => {
    // Never leave the shared database enforcing, whatever failed above.
    if (modeBefore === null) await db.systemSetting.deleteMany({ where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO } });
    else await db.systemSetting.update({ where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO }, data: { value: modeBefore } });
    await db.authzModeChange.deleteMany({ where: { requestedById: { in: [id.adminA, id.adminB, id.officer].filter(Boolean) } } });
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    if (id.adminRole && grantedToAdminHere.length) {
      await db.rolePermission.deleteMany({ where: { roleId: id.adminRole, permissionId: { in: grantedToAdminHere } } });
    }
    authz?.onModuleDestroy();
    await pg.end();
    await db.$disconnect();
  });

  beforeEach(async () => {
    AuthzService.enforceAvailable = true;
    audit.log.mockClear();
    await backToOff();
  });

  describe('the comparison: who gains and loses what if enforced now', () => {
    it('names the officer whose team gives less than the role, with exactly what would be lost', async () => {
      const comparison = await service.comparison();
      const officer = comparison.impacts.find((i) => i.userId === id.officer)!;
      expect(officer.name).toBe(`${tag}-officer`);
      expect(officer.lost.map((d) => d.permission).sort()).toEqual(['delete:Petition', 'read:Role', 'write:Role']);
      expect(officer.gained).toEqual([]);
      // Reading stays, narrower: the role reached the whole team, the template only the officer's own records.
      expect(officer.changed).toEqual([expect.objectContaining({ permission: 'read:Petition', before: 'TEAM_TREE', after: 'OWN' })]);
      expect(comparison.summary.losing).toBeGreaterThanOrEqual(1);
      expect(comparison.people).toBeGreaterThanOrEqual(3);
    });

    it('counts as losing somebody whose reach narrows though no permission goes away', async () => {
      const comparison = await service.comparison();
      const officer = comparison.impacts.find((i) => i.userId === id.officer)!;
      expect(officer.changed.find((d) => d.permission === 'read:Petition')).toMatchObject({ narrower: true });
      // Take the three lost permissions out of the picture: the narrowing alone must still count.
      const onlyNarrowed = comparison.impacts.filter((i) => i.lost.length === 0 && i.changed.some((d) => d.narrower));
      const lostSomething = comparison.impacts.filter((i) => i.lost.length > 0);
      expect(comparison.summary.losing).toBe(new Set([...onlyNarrowed, ...lostSomething].map((i) => i.userId)).size);
    });

    it('a member of a team that no longer counts is shown as losing that team (the role path still counts it today)', async () => {
      const paused = await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Tổ đã ngừng`, status: 'INACTIVE', isActive: false } });
      const retired = await db.user.create({ data: { username: `${tag}-retired`, passwordHash: 'x', roleId: id.officerRole, isActive: true } });
      await db.userTeam.create({ data: { userId: retired.id, teamId: paused.id } });
      try {
        await authz.refresh();
        const impact = (await service.comparison()).impacts.find((i) => i.userId === retired.id);
        // Nothing is configured for that team: the permissions stay, what they reach does not.
        expect(impact).toBeDefined();
        expect(impact!.lost).toEqual([]);
        expect(impact!.changed.find((d) => d.permission === 'read:Petition')).toMatchObject({ teamsLost: [paused.id], narrower: true });
      } finally {
        await db.userTeam.deleteMany({ where: { teamId: paused.id } });
        await db.user.delete({ where: { id: retired.id } });
        await db.team.delete({ where: { id: paused.id } });
        await authz.refresh();
      }
    });

    it('administrators are not in it: nothing changes for them', async () => {
      const comparison = await service.comparison();
      expect(comparison.impacts.filter((i) => [id.adminA, id.adminB].includes(i.userId))).toEqual([]);
    });

    it('the fingerprint stays the same while nothing changes, and moves when what would be lost moves', async () => {
      const first = await service.comparison();
      const impactOfOfficer = (c: typeof first) => JSON.stringify(c.impacts.find((i) => i.userId === id.officer));
      await db.permissionTemplateEntry.create({ data: { templateId: id.template, permissionId: perm['delete:Petition'], reach: 'OWN' } });
      await authz.refresh();
      const second = await service.comparison();
      expect(impactOfOfficer(second)).not.toBe(impactOfOfficer(first));
      expect(second.fingerprint).not.toBe(first.fingerprint);
      await db.permissionTemplateEntry.delete({ where: { templateId_permissionId: { templateId: id.template, permissionId: perm['delete:Petition'] } } });
      await authz.refresh();
      expect(impactOfOfficer(await service.comparison())).toBe(impactOfOfficer(first));
    });
  });

  describe('OFF and SHADOW: one administrator, at once', () => {
    it('switches, records who and why, audits the modes only, and the running system sees it', async () => {
      const result = await service.set(id.adminA, 'SHADOW', '  measuring before the pilot  ');
      expect(result.mode).toBe('SHADOW');
      expect(await stored()).toBe('SHADOW');
      expect((await authz.snapshot()).mode).toBe('SHADOW');
      const [row] = (await mine()).slice(-1);
      expect(row).toMatchObject({ fromMode: 'OFF', toMode: 'SHADOW', status: 'APPLIED', requestedById: id.adminA, decidedById: id.adminA, reason: 'measuring before the pilot' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: id.adminA, action: 'AUTHZ_MODE_CHANGED', subject: 'Role', subjectId: row.id, metadata: { from: 'OFF', to: 'SHADOW' } }),
        expect.anything(),
      );
    });

    it('refuses: no reason, the mode it already is, somebody who is not an administrator, and ENFORCE itself', async () => {
      await expect(service.set(id.adminA, 'SHADOW', '   ')).rejects.toEqual(code(AUTHZ_MODE_ERROR.REASON_REQUIRED));
      await expect(service.set(id.adminA, 'OFF', 'again')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ALREADY));
      // The officer's ROLE holds write:Role, so the route would let them in: the service still refuses.
      await expect(service.set(id.officer, 'SHADOW', 'I would like to')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
      await expect(service.set(id.adminA, 'ENFORCE', 'directly')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ENFORCE_NEEDS_REQUEST));
      expect((await stored()) ?? 'OFF').toBe('OFF');
    });
  });

  describe('ENFORCE: asked by one administrator, approved by another, on a comparison both read', () => {
    it('the whole way: ask, approve, enforced; then one administrator alone switches it off again', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot with team T', fingerprint));
      expect((await stored()) ?? 'OFF').toBe('OFF');
      const status = await service.status();
      expect(status.pending).toMatchObject({ id: asked.id, status: 'PENDING', requestedById: id.adminA, requestedByName: `${tag}-adminA`, toMode: 'ENFORCE' });
      expect(status.enforcing).toBe(false);

      const approved = await onFreshComparison((fingerprint) => service.approve(asked.id, id.adminB, fingerprint));
      expect(approved).toEqual({ id: asked.id, mode: 'ENFORCE' });
      expect(await stored()).toBe('ENFORCE');
      expect(authz.state()).toBe('ENFORCE');
      expect((await service.status()).enforcing).toBe(true);
      expect((await db.authzModeChange.findUnique({ where: { id: asked.id } }))!).toMatchObject({ status: 'APPLIED', decidedById: id.adminB });
      // Enforced means enforced: the officer no longer holds what only the role gave.
      expect((await authz.effective(id.officer)).keys).toEqual(['read:Petition']);

      // The way back is one step, by one person.
      await service.set(id.adminB, 'OFF', 'pilot over');
      expect(await stored()).toBe('OFF');
      expect(authz.state()).toBe('OFF');
      expect((await service.status()).pending).toBeNull();
    });

    it('the asker cannot approve their own request', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(onFreshComparison((fingerprint) => service.approve(asked.id, id.adminA, fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.SECOND_ADMIN_REQUIRED));
      expect((await stored()) ?? 'OFF').toBe('OFF');
    });

    it('a comparison that was not read (a wrong fingerprint) is refused, when asking and when approving', async () => {
      await expect(service.requestEnforce(id.adminA, 'pilot', 'not-what-the-screen-showed')).rejects.toEqual(code(AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(service.approve(asked.id, id.adminB, 'not-what-the-screen-showed')).rejects.toEqual(code(AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
      expect((await stored()) ?? 'OFF').toBe('OFF');
    });

    it('the configuration changed after the request: approving is refused although the approver read the NEW comparison', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await db.permissionTemplateEntry.create({ data: { templateId: id.template, permissionId: perm['delete:Petition'], reach: 'OWN' } });
      try {
        await authz.refresh();
        const { fingerprint } = await service.comparison();
        await expect(service.approve(asked.id, id.adminB, fingerprint)).rejects.toEqual(code(AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
        expect((await stored()) ?? 'OFF').toBe('OFF');
      } finally {
        await db.permissionTemplateEntry.delete({ where: { templateId_permissionId: { templateId: id.template, permissionId: perm['delete:Petition'] } } });
        await authz.refresh();
      }
    });

    it('something changed while the approval was being judged: refused, though the fingerprint sent is the right one', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      const { fingerprint } = await service.comparison();
      // Every time the configuration is read, something is logged right after: the snapshot judged from is always
      // one step behind the database. (A team created and removed changes nobody's permissions: the fingerprint
      // stays right, so only the check against the change log can refuse.)
      const read = authz.snapshot.bind(authz);
      const behind = jest.spyOn(authz, 'snapshot').mockImplementation(async () => {
        const snapshot = await read();
        const bump = await db.team.create({ data: { code: `${tag}-bump-${randomUUID().slice(0, 6)}`, name: `${tag} bump` } });
        await db.team.delete({ where: { id: bump.id } });
        return snapshot;
      });
      try {
        await expect(service.approve(asked.id, id.adminB, fingerprint)).rejects.toEqual(code(AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
        expect((await stored()) ?? 'OFF').toBe('OFF');
      } finally {
        behind.mockRestore();
      }
      // With the database standing still, the very same request is approved.
      await expect(onFreshComparison((again) => service.approve(asked.id, id.adminB, again))).resolves.toEqual({ id: asked.id, mode: 'ENFORCE' });
    });

    it('an administrator switched off or demoted is refused at once, whatever their token still says', async () => {
      await db.user.update({ where: { id: id.adminB }, data: { isActive: false } });
      try {
        await expect(service.set(id.adminB, 'SHADOW', 'still here')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
      } finally {
        await db.user.update({ where: { id: id.adminB }, data: { isActive: true } });
      }
      expect((await stored()) ?? 'OFF').toBe('OFF');
    });

    it('one request at a time; a request nobody approved in time is void and a new one can be made', async () => {
      const first = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(onFreshComparison((fingerprint) => service.requestEnforce(id.adminB, 'me too', fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_PENDING));
      const later = new Date(Date.now() + MODE_REQUEST_TTL_MS + 60_000);
      await expect(onFreshComparison((fingerprint) => service.approve(first.id, id.adminB, fingerprint, undefined, later))).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_EXPIRED));
      expect((await service.status(later)).pending).toBeNull();
      const second = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminB, 'again', fingerprint, undefined, later));
      expect(second.id).not.toBe(first.id);
    });

    it('the way back from a request: the asker withdraws it, another administrator rejects it; a closed one cannot be approved', async () => {
      const first = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(service.close(first.id, id.adminA)).resolves.toEqual({ id: first.id, status: 'WITHDRAWN' });
      await expect(onFreshComparison((fingerprint) => service.approve(first.id, id.adminB, fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING));
      const second = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(service.close(second.id, id.adminB)).resolves.toEqual({ id: second.id, status: 'REJECTED' });
      await expect(service.close(second.id, id.adminB)).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING));
      await expect(service.close('no-such-request', id.adminB)).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_NOT_FOUND));
      expect((await stored()) ?? 'OFF').toBe('OFF');
    });

    it('switching to SHADOW while a request waits makes the request lapse', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await service.set(id.adminB, 'SHADOW', 'measure first');
      expect((await db.authzModeChange.findUnique({ where: { id: asked.id } }))!.status).toBe('SUPERSEDED');
      await expect(onFreshComparison((fingerprint) => service.approve(asked.id, id.adminB, fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING));
    });

    it('only administrators ask and approve, whatever their role lets them do on the route', async () => {
      await expect(onFreshComparison((fingerprint) => service.requestEnforce(id.officer, 'pilot', fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await expect(onFreshComparison((fingerprint) => service.approve(asked.id, id.officer, fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
      await expect(service.close(asked.id, id.officer)).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
    });

    it('a request left by somebody who is no longer an administrator cannot be approved', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      await db.user.update({ where: { id: id.adminA }, data: { roleId: id.officerRole } });
      try {
        await expect(onFreshComparison((fingerprint) => service.approve(asked.id, id.adminB, fingerprint))).rejects.toEqual(code(AUTHZ_MODE_ERROR.ADMIN_ONLY));
        expect((await stored()) ?? 'OFF').toBe('OFF');
      } finally {
        await db.user.update({ where: { id: id.adminA }, data: { roleId: id.adminRole } });
        await db.authzModeChange.update({ where: { id: asked.id }, data: { status: 'WITHDRAWN' } });
      }
    });

    it('a build that cannot enforce refuses to ask and to approve', async () => {
      const asked = await onFreshComparison((fingerprint) => service.requestEnforce(id.adminA, 'pilot', fingerprint));
      AuthzService.enforceAvailable = false;
      await expect(service.requestEnforce(id.adminB, 'pilot', 'x')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ENFORCE_NOT_AVAILABLE));
      await expect(service.approve(asked.id, id.adminB, 'x')).rejects.toEqual(code(AUTHZ_MODE_ERROR.ENFORCE_NOT_AVAILABLE));
      expect((await service.status()).enforceAvailable).toBe(false);
    });
  });
});
