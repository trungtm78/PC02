import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { installTriggerSection } from '../../common/testing/install-trigger-section';
import { randomUUID } from 'node:crypto';
import { AuthzService } from '../authz.service';
import { AuthzAdminController } from './authz-admin.controller';
import { AuthzAdminService } from './authz-admin.service';
import type { TeamDoc, TemplateDoc } from './documents';

/**
 * The permission configuration written on a REAL PostgreSQL: every save is all or nothing, checked first, recorded
 * with what it replaced, guarded against two editors, and undoable.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('AuthzAdminService on PostgreSQL', () => {
  // One lock serialises every save, and the scratch database is shared when the whole suite runs in parallel.
  jest.setTimeout(30_000);
  let db: PrismaClient;
  let pg: Client;
  let authz: AuthzService;
  let admin: AuthzAdminService;
  let controller: AuthzAdminController;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `aa-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let n = 0;
  const req = { ip: '127.0.0.1', headers: { 'user-agent': 'spec' } } as never;
  const actor = () => ({ id: id.admin }) as never;

  const tpl = (over: Partial<TemplateDoc> = {}): TemplateDoc => {
    n += 1;
    return { code: `${tag}-T${n}`, name: `${tag} mẫu ${n}`, description: null, status: 'ACTIVE', entries: { 'read:Case': 'OWN' }, ...over };
  };
  const team = (over: Partial<TeamDoc> = {}): TeamDoc => ({ mode: 'EXPLICIT', memberTemplateId: null, leaderTemplateId: null, overrides: [], ...over });
  async function newTemplate(over: Partial<TemplateDoc> = {}) {
    const templateId = admin.newTemplateId();
    await admin.commit(id.admin, 'TEMPLATE_CREATED', [{ type: 'template', id: templateId, after: tpl(over) }]);
    return templateId;
  }
  async function saveOverrides(userId: string, overrides: Parameters<AuthzAdminController['saveUserOverrides']>[1]['overrides'], who = actor()) {
    const { token } = await controller.userOverrides(userId);
    return controller.saveUserOverrides(userId, { overrides, expectedToken: token }, who, req);
  }
  /** Like the screen: a removal is sent with the revision that was read. */
  async function clear(teamId: string) {
    const revision = (await controller.listTeams()).find((t) => t.teamId === teamId)?.revision ?? 0;
    return controller.clearTeam(teamId, String(revision), actor(), req);
  }
  async function removeTemplate(templateId: string) {
    const revision = await db.permissionTemplate.findUnique({ where: { id: templateId }, select: { revision: true } });
    return controller.deleteTemplate(templateId, String(revision?.revision ?? 1), actor(), req);
  }
  async function newTeam() {
    n += 1;
    return (await db.team.create({ data: { code: `${tag}-${n}`, name: `${tag} Tổ ${n}` } })).id;
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    const perms: Record<string, string> = {};
    for (const key of ['read:Case', 'edit:Case', 'delete:Case', 'read:Petition', 'export_full:Petition', 'read:Directory', 'read:Lawyer']) {
      const [action, subject] = key.split(':');
      perms[key] = (await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } })).id;
    }
    // The saver holds everything used here except read:Lawyer.
    const adminRole = await db.role.create({
      data: { name: `${tag}-saver`, permissions: { create: Object.entries(perms).filter(([k]) => k !== 'read:Lawyer').map(([, permissionId]) => ({ permissionId })) } },
    });
    const officerRole = await db.role.create({
      data: { name: `${tag}-officer`, permissions: { create: ['read:Case', 'edit:Case', 'delete:Case'].map((k) => ({ permissionId: perms[k] })) } },
    });
    id.admin = (await db.user.create({ data: { username: `${tag}-admin`, passwordHash: 'x', roleId: adminRole.id } })).id;
    id.officer = (await db.user.create({ data: { username: `${tag}-officer`, passwordHash: 'x', roleId: officerRole.id, firstName: 'An', lastName: 'Nguyễn' } })).id;
    id.A = (await db.team.create({ data: { code: `${tag}-A`, name: `${tag} Tổ A` } })).id;
    await db.userTeam.create({ data: { userId: id.officer, teamId: id.A } });

    authz = new AuthzService(db as never);
    admin = new AuthzAdminService(db as never, authz, audit as never);
    controller = new AuthzAdminController(admin);
  });

  afterAll(async () => {
    await db.permissionChangeSet.deleteMany({ where: { actorId: id.admin } });
    await db.userPermissionOverride.deleteMany({ where: { user: { username: { startsWith: tag } } } });
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.permissionTemplate.deleteMany({ where: { name: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  describe('templates', () => {
    it('is created with its entries, recorded with what it replaced (nothing), and audited by reference only', async () => {
      audit.log.mockClear();
      const created = await controller.createTemplate({ name: `${tag} Cán bộ`, entries: { 'read:Case': 'TEAM', 'edit:Case': 'OWN' } }, actor(), req);
      expect(created).toMatchObject({ changed: true, items: [{ type: 'template', id: created.id }] });

      expect(await controller.getTemplate(created.id)).toMatchObject({
        name: `${tag} Cán bộ`, status: 'ACTIVE', revision: 1, entries: { 'read:Case': 'TEAM', 'edit:Case': 'OWN' },
      });
      const set = await db.permissionChangeSet.findUniqueOrThrow({ where: { id: created.changeSetId! } });
      expect(set).toMatchObject({ kind: 'TEMPLATE_CREATED', actorId: id.admin });
      expect((set.changes as never as { before: unknown }[])[0].before).toBeNull();
      expect(audit.log.mock.calls[0][0]).toMatchObject({ action: 'AUTHZ_CONFIG_CHANGED', metadata: { kind: 'TEMPLATE_CREATED', items: [{ type: 'template', id: created.id }] } });
      // Written with the transaction of the change itself.
      expect(audit.log.mock.calls[0][1]).toBeDefined();
    });

    it('is edited at the revision it was read at; a second editor with the old revision is told, and nothing of theirs is written', async () => {
      const t = await newTemplate();
      const first = await controller.updateTemplate(t, { name: `${tag} đổi tên`, expectedRevision: 1 }, actor(), req);
      expect(first.changed).toBe(true);
      await expect(controller.updateTemplate(t, { entries: { 'read:Case': 'ALL' }, expectedRevision: 1 }, actor(), req)).rejects.toMatchObject({
        status: 409, response: { code: 'REVISION_CONFLICT', details: [{ type: 'template', id: t }] },
      });
      expect(await controller.getTemplate(t)).toMatchObject({ name: `${tag} đổi tên`, revision: 2, entries: { 'read:Case': 'OWN' } });
    });

    it('saving exactly what is there changes nothing and writes no history', async () => {
      const t = await newTemplate();
      const before = await db.permissionChangeSet.count({ where: { actorId: id.admin } });
      const current = await controller.getTemplate(t);
      expect(await controller.updateTemplate(t, { name: current.name, entries: current.entries, expectedRevision: 1 }, actor(), req)).toEqual({
        changed: false, changeSetId: null, items: [],
      });
      expect(await db.permissionChangeSet.count({ where: { actorId: id.admin } })).toBe(before);
      expect((await controller.getTemplate(t)).revision).toBe(1);
    });

    it('a template that breaks the rules is refused whole, with every reason', async () => {
      const refused = controller.createTemplate(
        { name: `${tag} sai`, entries: { 'edit:Case': 'TEAM', 'read:Lawyer': 'OWN', 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' } }, actor(), req,
      );
      await expect(refused).rejects.toMatchObject({ status: 400, response: { code: 'AUTHZ_CHANGE_INVALID' } });
      const error = (await refused.catch((e: unknown) => e)) as { response: { details: { code: string; permission: string }[] } };
      const details = error.response.details.map((d) => `${d.code}:${d.permission}`).sort();
      expect(details).toEqual(['ABOVE_OWN:read:Lawyer', 'SENSITIVE_REASON_REQUIRED:export_full:Petition', 'WIDER_THAN_VIEW:edit:Case']);
      expect(await db.permissionTemplate.count({ where: { name: `${tag} sai` } })).toBe(0);
      // A reach that is not a reach at all is refused before anything else.
      await expect(controller.createTemplate({ name: 'x', entries: { 'read:Case': 'EVERYTHING' } }, actor(), req)).rejects.toMatchObject({ status: 400 });
    });

    it('a sensitive grant goes through with a reason', async () => {
      const ok = await controller.createTemplate(
        { name: `${tag} xuất`, entries: { 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' }, reason: 'Phòng tổng hợp cần xuất' }, actor(), req,
      );
      expect((await db.permissionChangeSet.findUniqueOrThrow({ where: { id: ok.changeSetId! } })).reason).toBe('Phòng tổng hợp cần xuất');
    });

    it('is copied under a new name, archived and restored', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'TEAM_TREE', 'delete:Case': 'OWN' } });
      const copy = await controller.copyTemplate(t, { name: `${tag} bản sao` }, actor(), req);
      expect(await controller.getTemplate(copy.id)).toMatchObject({ name: `${tag} bản sao`, entries: { 'read:Case': 'TEAM_TREE', 'delete:Case': 'OWN' }, status: 'ACTIVE' });

      await controller.archiveTemplate(t, { expectedRevision: 1 }, actor(), req);
      expect((await controller.getTemplate(t)).status).toBe('ARCHIVED');
      expect((await controller.listTemplates()).find((x) => x.id === t)).toMatchObject({ status: 'ARCHIVED', usedByTeams: 0 });
      await controller.restoreTemplate(t, { expectedRevision: 2 }, actor(), req);
      expect((await controller.getTemplate(t)).status).toBe('ACTIVE');
    });

    it('is really deleted while no team uses it; one in use is refused with the teams that use it', async () => {
      const free = await newTemplate();
      await removeTemplate(free);
      await expect(controller.getTemplate(free)).rejects.toMatchObject({ status: 404 });

      const used = await newTemplate();
      await controller.saveTeam(id.A, { ...team({ memberTemplateId: used }), expectedRevision: 0 }, actor(), req);
      await expect(removeTemplate(used)).rejects.toMatchObject({
        status: 409, response: { code: 'TEMPLATE_IN_USE', details: [{ teamId: id.A, name: `${tag} Tổ A` }] },
      });
      expect((await controller.getTemplate(used)).status).toBe('ACTIVE');
      await clear(id.A);
    });

    it('two templates cannot take the same code', async () => {
      const code = `${tag}-SAME`;
      await controller.createTemplate({ name: `${tag} một`, code, entries: {} }, actor(), req);
      await expect(controller.createTemplate({ name: `${tag} hai`, code, entries: {} }, actor(), req)).rejects.toMatchObject({
        status: 409, response: { code: 'TEMPLATE_CODE_TAKEN' },
      });
    });
  });

  describe('what a team gives', () => {
    it('is saved, noticed by the engine at once, replaced, and removed (the team follows the roles again)', async () => {
      const member = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      expect((await authz.effective(id.officer)).keys).toEqual(['delete:Case', 'edit:Case', 'read:Case']);

      await controller.saveTeam(
        id.A,
        { ...team({ memberTemplateId: member, overrides: [{ permission: 'read:Directory', effect: 'GRANT', reach: 'ALL', reason: 'tra cứu danh mục', expiresAt: null, audience: 'ALL' }] }), expectedRevision: 0 },
        actor(), req,
      );
      expect((await authz.effective(id.officer)).keys).toEqual(['read:Case', 'read:Directory']);
      const listed = (await controller.listTeams()).find((t) => t.teamId === id.A)!;
      expect(listed).toMatchObject({ revision: 1, members: 1, governedByTeamId: id.A, config: { mode: 'EXPLICIT', memberTemplateId: member } });

      await expect(controller.saveTeam(id.A, { ...team(), expectedRevision: 0 }, actor(), req)).rejects.toMatchObject({ response: { code: 'REVISION_CONFLICT' } });
      await controller.saveTeam(id.A, { ...team({ memberTemplateId: member }), expectedRevision: 1 }, actor(), req);
      expect(await db.teamPermissionOverride.count({ where: { teamId: id.A } })).toBe(0);

      await clear(id.A);
      expect((await authz.effective(id.officer)).keys).toEqual(['delete:Case', 'edit:Case', 'read:Case']);
      expect((await controller.listTeams()).find((t) => t.teamId === id.A)).toMatchObject({ revision: 0, config: null, governedByTeamId: null });
    });

    it('refuses a template that does not exist, an archived one newly chosen, and a team that does not exist', async () => {
      await expect(controller.saveTeam(id.A, { ...team({ memberTemplateId: 'nope' }), expectedRevision: 0 }, actor(), req)).rejects.toMatchObject({
        response: { code: 'AUTHZ_CHANGE_INVALID', details: [expect.objectContaining({ code: 'TEMPLATE_NOT_FOUND' })] },
      });
      const old = await newTemplate({ status: 'ARCHIVED' });
      const current = await newTemplate();
      await expect(controller.saveTeam(id.A, { ...team({ memberTemplateId: current, leaderTemplateId: old }), expectedRevision: 0 }, actor(), req)).rejects.toMatchObject({
        response: { details: [expect.objectContaining({ code: 'TEMPLATE_ARCHIVED' })] },
      });
      await expect(controller.saveTeam('no-team', { ...team(), expectedRevision: 0 }, actor(), req)).rejects.toMatchObject({ status: 404 });
      expect(await db.teamPermissionConfig.count({ where: { teamId: id.A } })).toBe(0);
    });

    it('removing something is sent with the revision that was read: none or a stale one is refused', async () => {
      const t = await newTemplate();
      const target = await newTeam();
      await controller.saveTeam(target, { ...team({ memberTemplateId: t }), expectedRevision: 0 }, actor(), req);
      for (const none of [undefined, '', 'abc', '-1', '1.5']) {
        await expect(controller.clearTeam(target, none, actor(), req)).rejects.toMatchObject({ status: 400, response: { code: 'EXPECTED_REVISION_REQUIRED' } });
        await expect(controller.deleteTemplate(t, none, actor(), req)).rejects.toMatchObject({ status: 400, response: { code: 'EXPECTED_REVISION_REQUIRED' } });
      }
      await expect(controller.clearTeam(target, '7', actor(), req)).rejects.toMatchObject({ status: 409, response: { code: 'REVISION_CONFLICT' } });
      expect(await db.teamPermissionConfig.count({ where: { teamId: target } })).toBe(1);
      await clear(target);
      await expect(controller.deleteTemplate(t, '9', actor(), req)).rejects.toMatchObject({ status: 409, response: { code: 'REVISION_CONFLICT' } });
      await removeTemplate(t);
      expect(await db.permissionTemplate.count({ where: { id: t } })).toBe(0);
    });

    it('"follow the parent" is stored as no configuration at all, and its own configuration needs a member template', async () => {
      const t = await newTemplate();
      const target = await newTeam();
      await controller.saveTeam(target, { ...team({ memberTemplateId: t }), expectedRevision: 0 }, actor(), req);
      await controller.saveTeam(target, { mode: 'INHERIT', memberTemplateId: t, expectedRevision: 1 }, actor(), req);
      expect(await db.teamPermissionConfig.count({ where: { teamId: target } })).toBe(0);
      await expect(controller.saveTeam(target, { ...team(), expectedRevision: 0 }, actor(), req)).rejects.toMatchObject({
        response: { code: 'AUTHZ_CHANGE_INVALID', details: [expect.objectContaining({ code: 'MEMBER_TEMPLATE_REQUIRED' })] },
      });
    });

    it('many teams at once: all of them or none', async () => {
      const member = await newTemplate();
      const [x, y] = [await newTeam(), await newTeam()];
      // One of the three does not exist: nothing is applied to the other two.
      await expect(
        controller.applyTeams({ teamIds: [x, y, 'ghost'], config: team({ memberTemplateId: member }), expected: { [x]: 0, [y]: 0, ghost: 0 } }, actor(), req),
      ).rejects.toMatchObject({ status: 404 });
      expect(await db.teamPermissionConfig.count({ where: { teamId: { in: [x, y] } } })).toBe(0);

      const applied = await controller.applyTeams({ teamIds: [x, y, x], config: team({ memberTemplateId: member }), expected: { [x]: 0, [y]: 0 } }, actor(), req);
      expect(applied.items).toHaveLength(2);
      expect(await db.teamPermissionConfig.count({ where: { teamId: { in: [x, y] }, memberTemplateId: member } })).toBe(2);

      // The way back for many at once: no configuration.
      await controller.applyTeams({ teamIds: [x, y], config: null, expected: { [x]: 1, [y]: 1 } }, actor(), req);
      expect(await db.teamPermissionConfig.count({ where: { teamId: { in: [x, y] } } })).toBe(0);
    });
  });

  describe('a person\'s own overrides', () => {
    it('are saved as the whole list, read back, and removed with an empty list', async () => {
      const end = new Date(Date.now() + 86_400_000).toISOString();
      await saveOverrides(id.officer, [
        { permission: 'read:Petition', effect: 'GRANT', reach: 'OWN', reason: 'hỗ trợ tổ khác', expiresAt: end },
        { permission: 'delete:Case', effect: 'MUTE', reason: 'đang tập sự' },
      ]);
      expect((await controller.userOverrides(id.officer)).overrides).toEqual([
        { permission: 'read:Petition', effect: 'GRANT', reach: 'OWN', reason: 'hỗ trợ tổ khác', expiresAt: end },
        { permission: 'delete:Case', effect: 'MUTE', reach: null, reason: 'đang tập sự', expiresAt: null },
      ]);
      expect((await authz.effective(id.officer)).keys).toEqual(['edit:Case', 'read:Case', 'read:Petition']);

      await saveOverrides(id.officer, []);
      expect((await controller.userOverrides(id.officer)).overrides).toEqual([]);
      await expect(controller.userOverrides('nobody')).rejects.toMatchObject({ status: 404 });
      await expect(controller.saveUserOverrides('nobody', { overrides: [], expectedToken: 'x' }, actor(), req)).rejects.toMatchObject({ status: 404 });
    });

    it('an override without a reason is refused', async () => {
      await expect(
        saveOverrides(id.officer, [{ permission: 'read:Petition', effect: 'GRANT', reach: 'OWN', reason: '  ' }]),
      ).rejects.toMatchObject({ response: { details: [expect.objectContaining({ code: 'OVERRIDE_REASON_REQUIRED' })] } });
    });
  });

  describe('two people editing', () => {
    it('a person\'s list saved from a stale reading is refused: the other editor\'s mute is not silently removed', async () => {
      const stale = (await controller.userOverrides(id.officer)).token;
      await saveOverrides(id.officer, [{ permission: 'delete:Case', effect: 'MUTE', reason: 'tạm khoá xoá' }]);
      await expect(
        controller.saveUserOverrides(id.officer, { overrides: [{ permission: 'read:Petition', effect: 'GRANT', reach: 'OWN', reason: 'r' }], expectedToken: stale }, actor(), req),
      ).rejects.toMatchObject({ status: 409, response: { code: 'REVISION_CONFLICT', details: [{ type: 'user', id: id.officer }] } });
      expect((await controller.userOverrides(id.officer)).overrides).toMatchObject([{ permission: 'delete:Case', effect: 'MUTE' }]);
      await saveOverrides(id.officer, []);
    });

    it('applying to many teams needs the revision of every one of them', async () => {
      const [x, y] = [await newTeam(), await newTeam()];
      for (const expected of [{}, { [x]: 0 }, { [x]: 0, [y]: -1 }, { [x]: 0, [y]: 1.5 }] as Record<string, number>[]) {
        await expect(controller.applyTeams({ teamIds: [x, y], config: team(), expected }, actor(), req)).rejects.toMatchObject({
          status: 400, response: { code: 'EXPECTED_REVISION_REQUIRED' },
        });
      }
      expect(await db.teamPermissionConfig.count({ where: { teamId: { in: [x, y] } } })).toBe(0);
    });
  });

  describe('a change is judged as a whole', () => {
    it('a template edited so that a team using it could change what it no longer sees is refused, naming the team', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'TEAM' } });
      const used = await newTeam();
      await controller.saveTeam(
        used,
        { ...team({ memberTemplateId: t, overrides: [{ permission: 'edit:Case', effect: 'GRANT', reach: 'TEAM', reason: 'tổ được sửa', expiresAt: null, audience: 'ALL' }] }), expectedRevision: 0 },
        actor(), req,
      );
      await expect(controller.updateTemplate(t, { entries: { 'read:Case': 'OWN' }, expectedRevision: 1 }, actor(), req)).rejects.toMatchObject({
        status: 400,
        response: { code: 'AUTHZ_CHANGE_INVALID', details: [expect.objectContaining({ code: 'WIDER_THAN_VIEW', permission: 'edit:Case', type: 'team', id: used })] },
      });
      expect((await controller.getTemplate(t)).entries).toEqual({ 'read:Case': 'TEAM' });
    });

    it('a template that holds a sensitive permission is copied only with a reason', async () => {
      const created = await controller.createTemplate({ name: `${tag} nhạy cảm`, entries: { 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' }, reason: 'gốc' }, actor(), req);
      await expect(controller.copyTemplate(created.id, { name: `${tag} sao nhạy cảm` }, actor(), req)).rejects.toMatchObject({
        response: { details: [expect.objectContaining({ code: 'SENSITIVE_REASON_REQUIRED' })] },
      });
      const copy = await controller.copyTemplate(created.id, { name: `${tag} sao nhạy cảm`, reason: 'cho phòng khác' }, actor(), req);
      expect((await controller.getTemplate(copy.id)).entries).toEqual({ 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' });
    });

    it('what the history records is what was stored: a name typed with spaces is undone without "changed since"', async () => {
      const created = await controller.createTemplate({ name: `  ${tag} có khoảng trắng  `, entries: {} }, actor(), req);
      expect((await controller.getTemplate(created.id)).name).toBe(`${tag} có khoảng trắng`);
      await expect(controller.undo(created.changeSetId!, {}, actor(), req)).resolves.toMatchObject({ changed: true });
    });

    it('a change that cannot be audited is not saved', async () => {
      audit.log.mockRejectedValueOnce(new Error('audit down'));
      await expect(controller.createTemplate({ name: `${tag} không ghi được`, entries: {} }, actor(), req)).rejects.toThrow('audit down');
      expect(await db.permissionTemplate.count({ where: { name: `${tag} không ghi được` } })).toBe(0);
    });
  });

  describe('an undo is a save like any other', () => {
    it('putting a grant back needs the undoer to hold it', async () => {
      const junior = () => ({ id: id.officer }) as never; // holds read/edit/delete:Case only
      const target = await newTeam();
      const t = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      await controller.saveTeam(
        target,
        { ...team({ memberTemplateId: t, overrides: [{ permission: 'read:Directory', effect: 'GRANT', reach: 'ALL', reason: 'tra cứu', expiresAt: null, audience: 'ALL' }] }), expectedRevision: 0 },
        actor(), req,
      );
      const removal = await controller.saveTeam(target, { ...team({ memberTemplateId: t }), expectedRevision: 1 }, actor(), req);

      await expect(controller.undo(removal.changeSetId!, {}, junior(), req)).rejects.toMatchObject({
        status: 400, response: { code: 'AUTHZ_CHANGE_INVALID', details: [expect.objectContaining({ code: 'ABOVE_OWN', permission: 'read:Directory' })] },
      });
      expect(await db.teamPermissionOverride.count({ where: { teamId: target } })).toBe(0);
      // Somebody who holds it can.
      await expect(controller.undo(removal.changeSetId!, {}, actor(), req)).resolves.toMatchObject({ changed: true });
    });

    it('putting a sensitive grant back needs the undoer\'s own reason', async () => {
      const created = await controller.createTemplate({ name: `${tag} xuất 2`, entries: { 'read:Petition': 'ALL', 'export_full:Petition': 'ALL' }, reason: 'ban đầu' }, actor(), req);
      const removed = await controller.updateTemplate(created.id, { entries: { 'read:Petition': 'ALL' }, expectedRevision: 1 }, actor(), req);
      await expect(controller.undo(removed.changeSetId!, {}, actor(), req)).rejects.toMatchObject({
        response: { details: [expect.objectContaining({ code: 'SENSITIVE_REASON_REQUIRED' })] },
      });
      const undone = await controller.undo(removed.changeSetId!, { reason: 'gỡ nhầm' }, actor(), req);
      expect((await db.permissionChangeSet.findUniqueOrThrow({ where: { id: undone.changeSetId! } })).reason).toBe('gỡ nhầm');
    });

    it('an undo that would put a team back on a template deleted since is refused with the reason, not an error', async () => {
      const target = await newTeam();
      const t = await newTemplate();
      await controller.saveTeam(target, { ...team({ memberTemplateId: t }), expectedRevision: 0 }, actor(), req);
      const cleared = await clear(target);
      await removeTemplate(t);
      await expect(controller.undo(cleared.changeSetId!, {}, actor(), req)).rejects.toMatchObject({
        status: 400, response: { code: 'AUTHZ_CHANGE_INVALID', details: [expect.objectContaining({ code: 'TEMPLATE_NOT_FOUND', templateId: t })] },
      });
    });
  });

  describe('preview', () => {
    it('says who would lose and gain what, by name, and writes nothing', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      const before = await db.permissionChangeSet.count({ where: { actorId: id.admin } });
      const preview = await controller.preview({ teams: [{ teamId: id.A, config: team({ memberTemplateId: t }) }] });
      const mine = preview.impacts.find((i) => i.userId === id.officer)!;
      expect(mine).toMatchObject({
        name: 'Nguyễn An',
        lost: expect.arrayContaining([{ permission: 'edit:Case', before: 'TEAM_TREE', after: null }, { permission: 'delete:Case', before: 'TEAM_TREE', after: null }]),
        changed: [{ permission: 'read:Case', before: 'TEAM_TREE', after: 'OWN', teamsLost: [id.A] }],
        gained: [],
      });
      expect(preview.people).toBeGreaterThan(0);
      // Narrowed from "the team as today" to "own": the team is no longer reached, and is named.
      expect(preview.teamNames).toEqual({ [id.A]: `${tag} Tổ A` });
      expect(await db.teamPermissionConfig.count({ where: { teamId: id.A } })).toBe(0);
      expect(await db.permissionChangeSet.count({ where: { actorId: id.admin } })).toBe(before);
    });

    it('previews a template edited in place, a template deleted, and a person\'s overrides', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      await controller.saveTeam(id.A, { ...team({ memberTemplateId: t }), expectedRevision: 0 }, actor(), req);
      const widened = await controller.preview({ templates: [{ id: t, entries: { 'read:Case': 'TEAM' } }] });
      expect(widened.impacts.find((i) => i.userId === id.officer)!.changed).toEqual([
        // Wider (the whole team's records) and narrower (the person's own records that sit in another team).
        { permission: 'read:Case', before: 'OWN', after: 'TEAM', teamsGained: [id.A], narrower: true, wider: true },
      ]);
      const gone = await controller.preview({ templates: [{ id: t, entries: null }] });
      expect(gone.impacts.find((i) => i.userId === id.officer)!.lost).toEqual([{ permission: 'read:Case', before: 'OWN', after: null }]);
      const personal = await controller.preview({ users: [{ userId: id.officer, overrides: [{ permission: 'read:Directory', effect: 'GRANT', reach: 'ALL', reason: 'r' }] }] });
      expect(personal.impacts.find((i) => i.userId === id.officer)!.gained).toEqual([{ permission: 'read:Directory', before: null, after: 'ALL' }]);
      await clear(id.A);
    });
  });

  describe('history and undo', () => {
    it('lists changes newest first with who made them, and undo puts back what a change replaced, as a new change', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      const saved = await controller.saveTeam(id.A, { ...team({ memberTemplateId: t }), expectedRevision: 0 }, actor(), req);
      // Looked up by id: two changes saved within the same millisecond have no order between them.
      const entry = (await controller.history('5')).find((h) => h.id === saved.changeSetId)!;
      expect(entry).toMatchObject({ kind: 'TEAM_CONFIG_SAVED', actorId: id.admin, undoneById: null });
      expect(entry.changes[0]).toMatchObject({ type: 'team', id: id.A, before: null });

      const undone = await controller.undo(saved.changeSetId!, {}, actor(), req);
      expect(undone.changed).toBe(true);
      expect(await db.teamPermissionConfig.count({ where: { teamId: id.A } })).toBe(0);
      const after = await controller.history('5');
      expect(after.find((h) => h.id === undone.changeSetId)).toMatchObject({ kind: 'UNDO', revertsId: saved.changeSetId });
      expect(after.find((h) => h.id === saved.changeSetId)!.undoneById).toBe(undone.changeSetId);

      // Once only; and the undo itself can be undone (the configuration is back).
      await expect(controller.undo(saved.changeSetId!, {}, actor(), req)).rejects.toMatchObject({ status: 409, response: { code: 'AUTHZ_ALREADY_UNDONE' } });
      await controller.undo(undone.changeSetId!, {}, actor(), req);
      expect(await db.teamPermissionConfig.count({ where: { teamId: id.A, memberTemplateId: t } })).toBe(1);
      await clear(id.A);
    });

    it('refuses to undo a change whose object has been changed again since, naming it', async () => {
      const t = await newTemplate({ entries: { 'read:Case': 'OWN' } });
      const first = await controller.updateTemplate(t, { entries: { 'read:Case': 'TEAM' }, expectedRevision: 1 }, actor(), req);
      await controller.updateTemplate(t, { entries: { 'read:Case': 'ALL' }, expectedRevision: 2 }, actor(), req);
      await expect(controller.undo(first.changeSetId!, {}, actor(), req)).rejects.toMatchObject({
        status: 409, response: { code: 'AUTHZ_CHANGED_SINCE', details: [{ type: 'template', id: t }] },
      });
      expect((await controller.getTemplate(t)).entries).toEqual({ 'read:Case': 'ALL' });
    });

    it('undoing the creation of a template deletes it; an unknown change is a 404; the list pages', async () => {
      const created = await controller.createTemplate({ name: `${tag} tạm`, entries: {} }, actor(), req);
      await controller.undo(created.changeSetId!, {}, actor(), req);
      await expect(controller.getTemplate(created.id)).rejects.toMatchObject({ status: 404 });
      await expect(controller.undo('missing', {}, actor(), req)).rejects.toMatchObject({ status: 404 });
      const page = await controller.history('2');
      const next = await controller.history('2', page[1].id);
      expect(page).toHaveLength(2);
      expect(next.some((h) => page.some((p) => p.id === h.id))).toBe(false);
      expect((await controller.history()).length).toBeGreaterThan(2);
    });
  });
});
