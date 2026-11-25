import { randomUUID } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { TeamLifecycleService } from './team-lifecycle.service';
import { TeamMergeService, MERGE_ERROR } from './team-merge.service';
import { WARD_CHARGE_AUDIT, WARD_CHARGE_ERROR, WARD_CHARGE_IMPORT_ISSUE as ISSUE } from './team-ward-charges.codes';
import { TeamWardChargesImportService } from './team-ward-charges.import';
import { TeamWardChargesService } from './team-ward-charges.service';

/**
 * Which PC02 team is in charge of which ward, on a REAL PostgreSQL.
 *
 * Expected values come from the owner's request and the engineering review, not from running the code:
 *   one ward has at most one team in charge (UNIQUE ward key, whatever ward teams point at it);
 *   asking for wards another team holds is refused with EVERY such ward named, and nothing is written;
 *   of two admins saving the same ward at once, exactly one wins;
 *   the import reads the owner's real layout (header with a trailing space, "Khánh Hội ,", ": Vĩnh Tân", a count
 *   that is a formula, the merged "Tổng" row) and reports per row before anything is written;
 *   a team in charge of wards is not deleted nor archived silently; a merge moves its wards to the target.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('team ward charges on PostgreSQL', () => {
  jest.setTimeout(90_000);
  let scratch: ScratchDatabase;
  let charges: TeamWardChargesService;
  let imports: TeamWardChargesImportService;
  let lifecycle: TeamLifecycleService;
  let merges: TeamMergeService;
  // Letters only, so that it reads as a word of a name ("Vườn Lài zq1a2b3c4d").
  const tag = `zq${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const id: Record<string, string> = {};
  let provinceCreated = false;
  let n = 0;

  const fails = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return 'resolved';
    } catch (e) {
      const err = e as { getStatus?: () => number; getResponse?: () => unknown; message?: string };
      return { status: err.getStatus?.(), body: err.getResponse?.() ?? err.message };
    }
  };

  const team = async (name: string, data: Record<string, unknown> = {}) => {
    n += 1;
    return (await scratch.db.team.create({ data: { code: `${tag}-${n}`, name: `${name} ${tag}`, ...data } })).id;
  };
  const wardsOf = async (teamId: string) =>
    (await scratch.db.teamWardCharge.findMany({ where: { managerTeamId: teamId }, select: { wardDirectoryId: true } })).map((c) => c.wardDirectoryId).sort();
  const sorted = (...ids: string[]) => [...ids].sort();

  /** A workbook with the owner's layout: header (trailing space on B), one row per team, the merged "Tổng" row. */
  async function workbook(rows: [string, string, number | { formula: string; result: number }][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['STT', 'Đơn vị thuộc PC02 ', 'Công an cấp phường/xã tương ứng', 'Số lượng phường/xã']);
    rows.forEach(([teamName, wards, count], i) => ws.addRow([i + 1, teamName, wards, count]));
    const total = rows.length + 2;
    ws.getCell(`A${total}`).value = 'Tổng';
    ws.mergeCells(`A${total}:C${total}`);
    ws.getCell(`D${total}`).value = { formula: `SUM(D2:D${total - 1})`, result: 99 } as never;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    id.actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId: role.id } })).id;
    id.other = (await db.user.create({ data: { username: `${tag}-other`, passwordHash: 'x', roleId: role.id } })).id;

    const hcm = await db.directory.findFirst({ where: { type: 'PROVINCE', code: 'HCM' } });
    if (hcm) id.hcm = hcm.id;
    else {
      id.hcm = (await db.directory.create({ data: { type: 'PROVINCE', code: 'HCM', name: 'Thành phố Hồ Chí Minh' } })).id;
      provinceCreated = true;
    }
    id.elsewhere = (await db.directory.create({ data: { type: 'PROVINCE', code: `${tag}-P2`, name: `Tỉnh ${tag}` } })).id;
    const ward = async (key: string, name: string, data: Record<string, unknown> = {}) => {
      id[key] = (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: `${name} ${tag}`, parentId: id.hcm, ...data } })).id;
    };
    await ward('vuonLai', 'Phường Vườn Lài');
    await ward('banCo', 'Phường Bàn Cờ');
    await ward('khanhHoi', 'Phường Khánh Hội');
    await ward('vinhHoi', 'Phường Vĩnh Hội');
    await ward('vinhTan', 'Phường Vĩnh Tân');
    await ward('conDao', 'Đặc khu Côn Đảo');
    await ward('truVanTho', 'Xã Trừ Văn Thố');
    await ward('saiGon', 'Phường Sài Gòn');
    await ward('benThanh', 'Phường Bến Thành');
    await ward('closed', 'Phường Đã Nhập', { isActive: false });
    // Two wards of the city that only the accents tell apart (rows 7 and 13 of the owner's file).
    await ward('thanhAnAcute', 'Xã Thạnh An');
    await ward('thanhAnPlain', 'Xã Thanh An');
    // The same name in another province: the file names wards of the city only.
    id.saiGonElsewhere = (await db.directory.create({ data: { type: 'WARD', code: `${tag}-sg2`, name: `Phường Sài Gòn ${tag}`, parentId: id.elsewhere } })).id;
    id.crimeRow = (await db.directory.create({ data: { type: 'CRIME', code: `${tag}-c`, name: `Tội ${tag}` } })).id;

    // PC02 teams (no ward) and ward teams (level 2, with a ward).
    id.T1 = await team('Tổ công tác Số 1', { level: 1 });
    id.T4 = await team('Tổ công tác Số 4', { level: 1 });
    id.T9 = await team('Tổ công tác Số 9', { level: 1 });
    id.C1 = await team('Cơ sở 1', { level: 1 });
    id.wVuonLai = await team('Công an phường Vườn Lài', { level: 2, wardId: id.vuonLai });
    id.wBanCo = await team('Công an phường Bàn Cờ', { level: 2, wardId: id.banCo });
    id.wNoWard = await team('Công an phường chưa gắn', { level: 2 });
    id.wPaused = await team('Công an phường Sài Gòn', { level: 2, wardId: id.saiGon, status: 'INACTIVE', isActive: false });

    const audit = new AuditService(scratch.db as never);
    charges = new TeamWardChargesService(scratch.db as never, audit);
    imports = new TeamWardChargesImportService(scratch.db as never, audit);
    lifecycle = new TeamLifecycleService(scratch.db as never, audit);
    merges = new TeamMergeService(scratch.db as never, audit, lifecycle);
  });

  afterAll(async () => {
    const { db } = scratch;
    const teams = await db.team.findMany({ where: { code: { startsWith: tag } }, select: { id: true } });
    const ids = teams.map((t) => t.id);
    await db.teamWardCharge.deleteMany({ where: { OR: [{ managerTeamId: { in: ids } }, { ward: { code: { startsWith: tag } } }] } });
    await db.teamMergeOperation.deleteMany({ where: { OR: [{ sourceTeamId: { in: ids } }, { targetTeamId: { in: ids } }] } });
    await db.auditLog.deleteMany({ where: { userId: { in: [id.actor, id.other] } } });
    await db.team.deleteMany({ where: { id: { in: ids } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag }, type: 'WARD' } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    if (provinceCreated) await db.directory.deleteMany({ where: { id: id.hcm } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  describe('the choices and one team\'s set', () => {
    it('offers the active ward teams that have a ward, sorted by name, each with the team in charge of its ward', async () => {
      const mine = (await charges.choices()).filter((c) => c.name.endsWith(tag));
      expect(mine.map((c) => c.teamId)).toEqual([id.wBanCo, id.wVuonLai]);
      expect(mine[0]).toEqual({ teamId: id.wBanCo, name: `Công an phường Bàn Cờ ${tag}`, wardId: id.banCo, managerTeam: null });
    });

    it('replaces a team\'s set in one go, lists it with the ward team names, and audits what changed (ids only)', async () => {
      await charges.replace(id.T4, { wardIds: [id.vuonLai, id.banCo] }, id.actor);
      expect(await wardsOf(id.T4)).toEqual(sorted(id.vuonLai, id.banCo));
      const listed = await charges.replace(id.T4, { wardIds: [id.banCo, id.saiGon] }, id.actor);
      expect(await wardsOf(id.T4)).toEqual(sorted(id.banCo, id.saiGon));
      expect(listed).toEqual([
        { wardId: id.banCo, wardName: `Phường Bàn Cờ ${tag}`, wardTeamId: id.wBanCo, wardTeamName: `Công an phường Bàn Cờ ${tag}` },
        // The ward team of Sài Gòn is paused: the ward is still listed, by its directory name.
        { wardId: id.saiGon, wardName: `Phường Sài Gòn ${tag}`, wardTeamId: null, wardTeamName: null },
      ]);
      expect(await charges.listFor(id.T4)).toEqual(listed);
      const audits = await scratch.db.auditLog.findMany({ where: { userId: id.actor, action: WARD_CHARGE_AUDIT.REPLACED, subjectId: id.T4 }, orderBy: { createdAt: 'asc' } });
      expect(audits).toHaveLength(2);
      expect(audits[1].metadata).toMatchObject({ added: [id.saiGon], removed: [id.vuonLai], total: 2 });
      // The choices now show who holds Bàn Cờ.
      const banCo = (await charges.choices()).find((c) => c.teamId === id.wBanCo);
      expect(banCo?.managerTeam).toEqual({ id: id.T4, name: `Tổ công tác Số 4 ${tag}` });
    });

    it('a chip removed and saved removes the charge; an empty set removes all', async () => {
      await charges.replace(id.T4, { wardIds: [id.banCo] }, id.actor);
      expect(await wardsOf(id.T4)).toEqual([id.banCo]);
      await charges.replace(id.T4, { wardIds: [] }, id.actor);
      expect(await wardsOf(id.T4)).toEqual([]);
    });
  });

  describe('one ward, one team', () => {
    it('the database itself refuses a second charge of the same ward', async () => {
      await scratch.db.teamWardCharge.create({ data: { wardDirectoryId: id.vinhHoi, managerTeamId: id.T9, createdById: id.actor } });
      await expect(
        scratch.db.teamWardCharge.create({ data: { wardDirectoryId: id.vinhHoi, managerTeamId: id.T1, createdById: id.actor } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: id.vinhHoi } });
    });

    it('asking for wards of another team is refused with EVERY such ward and its team named; nothing is written', async () => {
      await charges.replace(id.T4, { wardIds: [id.vuonLai, id.banCo] }, id.actor);
      await charges.replace(id.T1, { wardIds: [id.khanhHoi] }, id.actor);
      const r = await fails(charges.replace(id.T1, { wardIds: [id.khanhHoi, id.vuonLai, id.banCo, id.vinhHoi] }, id.actor));
      expect(r).toMatchObject({
        status: 409,
        body: {
          code: WARD_CHARGE_ERROR.ALREADY_CHARGED,
          details: [
            { wardId: id.banCo, wardName: `Phường Bàn Cờ ${tag}`, teamId: id.T4, teamName: `Tổ công tác Số 4 ${tag}` },
            { wardId: id.vuonLai, wardName: `Phường Vườn Lài ${tag}`, teamId: id.T4, teamName: `Tổ công tác Số 4 ${tag}` },
          ],
        },
      });
      expect(await wardsOf(id.T1)).toEqual([id.khanhHoi]);
      expect(await wardsOf(id.T4)).toEqual(sorted(id.vuonLai, id.banCo));
    });

    it('an unknown id, a row that is not a ward, an inactive ward: 400 with a code naming them', async () => {
      const r = await fails(charges.replace(id.T1, { wardIds: [id.khanhHoi, 'missing', id.crimeRow, id.closed] }, id.actor));
      expect(r).toMatchObject({
        status: 400,
        body: { code: WARD_CHARGE_ERROR.WARD_INVALID, details: [{ wardId: 'missing' }, { wardId: id.crimeRow }, { wardId: id.closed }] },
      });
      expect(await fails(charges.replace(id.T1, { wardIds: 'x' }, id.actor))).toMatchObject({ status: 400, body: { code: WARD_CHARGE_ERROR.BODY_INVALID } });
    });

    it('only an ACTIVE team that is not a ward unit can be in charge', async () => {
      expect(await fails(charges.replace(id.wVuonLai, { wardIds: [id.vinhHoi] }, id.actor))).toMatchObject({ status: 409, body: { code: WARD_CHARGE_ERROR.MANAGER_INVALID } });
      const paused = await team('Tổ tạm ngừng', { status: 'INACTIVE', isActive: false });
      expect(await fails(charges.replace(paused, { wardIds: [id.vinhHoi] }, id.actor))).toMatchObject({ status: 409, body: { code: WARD_CHARGE_ERROR.MANAGER_INVALID } });
      expect(await fails(charges.replace('missing', { wardIds: [] }, id.actor))).toMatchObject({ status: 404 });
    });

    it('two admins saving the same ward for two teams at the same moment: exactly one wins, the other gets the 409', async () => {
      for (let round = 0; round < 3; round++) {
        await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: id.vinhTan } });
        const results = await Promise.allSettled([
          charges.replace(id.T9, { wardIds: [id.vinhTan] }, id.actor),
          charges.replace(id.C1, { wardIds: [id.vinhTan] }, id.other),
        ]);
        expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
        const lost = results.find((x) => x.status === 'rejected') as PromiseRejectedResult;
        const winner = results[0].status === 'fulfilled' ? id.T9 : id.C1;
        expect((lost.reason as { getResponse: () => unknown }).getResponse()).toMatchObject({
          code: WARD_CHARGE_ERROR.ALREADY_CHARGED,
          details: [{ wardId: id.vinhTan, teamId: winner }],
        });
        const rows = await scratch.db.teamWardCharge.findMany({ where: { wardDirectoryId: id.vinhTan } });
        expect(rows.map((x) => x.managerTeamId)).toEqual([winner]);
      }
      await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: id.vinhTan } });
    });
  });

  describe('import from Excel', () => {
    beforeAll(async () => {
      // As things stand: Tổ 4 holds Vườn Lài and Bàn Cờ, Tổ 1 holds Khánh Hội; Tổ 9 (not in the file) holds Vĩnh Hội.
      await scratch.db.teamWardCharge.deleteMany({ where: { ward: { code: { startsWith: tag } } } });
      await charges.replace(id.T4, { wardIds: [id.vuonLai, id.banCo] }, id.actor);
      await charges.replace(id.T1, { wardIds: [id.khanhHoi] }, id.actor);
      await charges.replace(id.T9, { wardIds: [id.vinhHoi] }, id.actor);
    });

    it('reads the real layout and its dirt, and reports per row: unknown team, unknown ward, a ward twice, a ward held outside the file, a wrong count', async () => {
      const file = await workbook([
        // Lower-case "số", extra spaces: the same team. "Khánh Hội ," and the final "." are the file's own dirt.
        [`Tổ công tác số  4 ${tag}`, `Vườn Lài ${tag}, Bàn Cờ ${tag}, Khánh Hội ${tag} ,`, { formula: '1+1', result: 2 }],
        [`Cơ sở 1 ${tag}`, `: Vĩnh Tân ${tag}, đặc khu Côn Đảo ${tag}, Trừ Văn Thố ${tag}, Sài Gòn ${tag}.`, 4],
        [`Tổ công tác Số 77 ${tag}`, `Bến Thành ${tag}.`, 1],
        [`Tổ công tác Số 1 ${tag}`, `Phố Không Có ${tag}, Vườn Lài ${tag}, Vĩnh Hội ${tag}.`, 3],
      ]);
      const preview = await imports.preview(file, id.actor);
      expect(preview.canConfirm).toBe(false);
      const [r4, rC1, r77, r1] = preview.rows;

      expect(r4).toMatchObject({ rowNumber: 2, teamId: id.T4, count: 2 });
      expect(r4.wards.map((w) => w.wardId)).toEqual([id.vuonLai, id.banCo, id.khanhHoi]);
      // Khánh Hội is held by Tổ 1, which IS in the file: it moves, no error.
      expect(r4.errors).toEqual([]);
      expect(r4.warnings).toEqual([{ code: ISSUE.COUNT_MISMATCH, expected: 2, listed: 3 }]);

      expect(rC1).toMatchObject({ teamId: id.C1, count: 4, errors: [], warnings: [] });
      expect(rC1.wards.map((w) => w.wardId)).toEqual([id.vinhTan, id.conDao, id.truVanTho, id.saiGon]);

      expect(r77.teamId).toBeNull();
      expect(r77.errors).toEqual([{ code: ISSUE.TEAM_NOT_FOUND, teamName: `Tổ công tác Số 77 ${tag}` }]);

      expect(r1.teamId).toBe(id.T1);
      expect(r1.errors).toEqual([
        { code: ISSUE.WARD_NOT_FOUND, ward: `Phố Không Có ${tag}` },
        { code: ISSUE.WARD_TWICE, ward: `Phường Vườn Lài ${tag}` },
        { code: ISSUE.WARD_CHARGED_OUTSIDE_FILE, ward: `Phường Vĩnh Hội ${tag}`, teamName: `Tổ công tác Số 9 ${tag}` },
      ]);
      expect(preview.totals).toEqual({ rows: 4, wards: 11, errors: 4, warnings: 1 });

      // Nothing was written, and a preview with errors cannot be confirmed.
      expect(await wardsOf(id.C1)).toEqual([]);
      expect(await fails(imports.confirm(preview.previewToken, true, id.actor))).toMatchObject({ status: 409, body: { code: WARD_CHARGE_ERROR.IMPORT_HAS_ERRORS } });
    });

    it('two wards only the accents tell apart ("Thạnh An", "Thanh An") are each matched to their own', async () => {
      const file = await workbook([
        [`Tổ công tác Số 4 ${tag}`, `Thạnh An ${tag}.`, 1],
        [`Cơ sở 1 ${tag}`, `Thanh An ${tag}.`, 1],
      ]);
      const preview = await imports.preview(file, id.actor);
      expect(preview.rows.map((r) => r.errors)).toEqual([[], []]);
      expect(preview.rows.map((r) => r.wards[0].wardId)).toEqual([id.thanhAnAcute, id.thanhAnPlain]);
    });

    it('refuses what is not the template: another header, not an xlsx', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('x').addRow(['A', 'B', 'C', 'D']);
      const wrong = Buffer.from(await wb.xlsx.writeBuffer());
      expect(await fails(imports.preview(wrong, id.actor))).toMatchObject({ status: 400, body: { code: WARD_CHARGE_ERROR.IMPORT_FILE_INVALID, details: [{ reason: 'HEADER' }] } });
      expect(await fails(imports.preview(Buffer.from('MZ not a zip at all'), id.actor))).toMatchObject({ status: 400, body: { code: WARD_CHARGE_ERROR.IMPORT_FILE_INVALID } });
      expect(await fails(imports.preview(Buffer.alloc(2 * 1024 * 1024, 1), id.actor))).toMatchObject({ status: 400, body: { details: [{ reason: 'TOO_LARGE' }] } });
    });

    it('confirm, replacing the teams of the file: their sets become exactly the file\'s, a ward moves between teams of the file, others are untouched', async () => {
      const file = await workbook([
        [`Tổ công tác Số 4 ${tag}`, `Vườn Lài ${tag}, Khánh Hội ${tag}.`, 2],
        [`Cơ sở 1 ${tag}`, `: Vĩnh Tân ${tag}, đặc khu Côn Đảo ${tag}.`, 2],
        [`Tổ công tác Số 1 ${tag}`, `Sài Gòn ${tag}.`, 1],
      ]);
      const preview = await imports.preview(file, id.actor);
      expect(preview.canConfirm).toBe(true);
      // Only the person who previewed may confirm.
      expect(await fails(imports.confirm(preview.previewToken, true, id.other))).toMatchObject({ status: 404, body: { code: WARD_CHARGE_ERROR.IMPORT_TOKEN_INVALID } });

      await expect(imports.confirm(preview.previewToken, true, id.actor)).resolves.toEqual({ added: 3, moved: 1, removed: 1 });
      expect(await wardsOf(id.T4)).toEqual(sorted(id.vuonLai, id.khanhHoi)); // Bàn Cờ removed, Khánh Hội moved from Tổ 1
      expect(await wardsOf(id.C1)).toEqual(sorted(id.vinhTan, id.conDao));
      expect(await wardsOf(id.T1)).toEqual([id.saiGon]);
      expect(await wardsOf(id.T9)).toEqual([id.vinhHoi]);
      const audit = await scratch.db.auditLog.findFirst({ where: { userId: id.actor, action: WARD_CHARGE_AUDIT.IMPORTED } });
      expect(audit?.metadata).toMatchObject({ teams: 3, wards: 5, replaceTeamsInFile: true, added: 3, moved: 1, removed: 1 });
      // A token is used once.
      expect(await fails(imports.confirm(preview.previewToken, true, id.actor))).toMatchObject({ status: 404 });
    });

    it('confirm without replacing adds to the sets; a ward taken meanwhile by a team outside the file refuses the whole import', async () => {
      const file = await workbook([[`Tổ công tác Số 4 ${tag}`, `Bàn Cờ ${tag}, Trừ Văn Thố ${tag}.`, 2]]);
      const preview = await imports.preview(file, id.actor);
      expect(preview.canConfirm).toBe(true);
      await charges.replace(id.T9, { wardIds: [id.vinhHoi, id.truVanTho] }, id.actor);
      expect(await fails(imports.confirm(preview.previewToken, false, id.actor))).toMatchObject({
        status: 409,
        body: { code: WARD_CHARGE_ERROR.ALREADY_CHARGED, details: [{ wardId: id.truVanTho, teamId: id.T9 }] },
      });
      expect(await wardsOf(id.T4)).toEqual(sorted(id.vuonLai, id.khanhHoi));

      await charges.replace(id.T9, { wardIds: [id.vinhHoi] }, id.actor);
      await expect(imports.confirm(preview.previewToken, false, id.actor)).resolves.toEqual({ added: 2, moved: 0, removed: 0 });
      expect(await wardsOf(id.T4)).toEqual(sorted(id.vuonLai, id.khanhHoi, id.banCo, id.truVanTho));
    });

    it('the template has the same layout and holds the charges as they are: importing it back changes nothing', async () => {
      const file = await imports.template();
      const preview = await imports.preview(file, id.actor);
      const mine = preview.rows.filter((r) => r.teamName.endsWith(tag));
      expect(mine.map((r) => r.teamId).sort()).toEqual(sorted(id.T4, id.C1, id.T1, id.T9));
      for (const row of mine) {
        expect(row.errors).toEqual([]);
        expect(row.warnings).toEqual([]);
        expect(row.wards.map((w) => w.wardId).sort()).toEqual(await wardsOf(row.teamId!));
      }
    });
  });

  describe('the life of a team in charge of wards', () => {
    it('delete: the check counts the charges and the delete is refused; once the chips are removed, it deletes', async () => {
      const t = await team('Tổ sẽ xoá');
      await charges.replace(t, { wardIds: [id.benThanh] }, id.actor);
      expect(await lifecycle.deletionCheck(t)).toMatchObject({ deletable: false, blockers: [{ table: 'team_ward_charges', column: 'managerTeamId', count: 1 }] });
      expect(await fails(lifecycle.deleteIfEmpty(t, id.actor))).toMatchObject({
        status: 409,
        body: { code: 'TEAM_HAS_DATA', details: [{ table: 'team_ward_charges', column: 'managerTeamId', count: 1 }] },
      });
      expect(await wardsOf(t)).toEqual([id.benThanh]);
      await charges.replace(t, { wardIds: [] }, id.actor);
      await expect(lifecycle.deleteIfEmpty(t, id.actor)).resolves.toEqual({ success: true });
      expect(await scratch.db.team.findUnique({ where: { id: t } })).toBeNull();
    });

    it('archive is refused while the team is in charge of wards; pausing keeps them', async () => {
      const t = await team('Tổ sẽ lưu trữ');
      await charges.replace(t, { wardIds: [id.benThanh] }, id.actor);
      expect(await fails(lifecycle.setStatus(t, 'ARCHIVED', id.actor))).toMatchObject({ status: 409, body: { code: WARD_CHARGE_ERROR.HAS_CHARGES, details: [{ count: 1 }] } });
      expect((await scratch.db.team.findUniqueOrThrow({ where: { id: t } })).status).toBe('ACTIVE');
      await lifecycle.setStatus(t, 'INACTIVE', id.actor);
      expect(await wardsOf(t)).toEqual([id.benThanh]);
      await scratch.db.teamWardCharge.deleteMany({ where: { managerTeamId: t } });
    });

    it('merge moves the charges to the target (which keeps its own), undo puts them back; a ward unit cannot take them', async () => {
      const source = await team('Tổ gộp đi');
      const target = await team('Tổ gộp đến');
      await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: { in: [id.benThanh, id.vinhHoi] } } });
      await charges.replace(source, { wardIds: [id.benThanh, id.vinhHoi] }, id.actor);
      const ownOfTarget = id.conDao;
      await scratch.db.teamWardCharge.deleteMany({ where: { wardDirectoryId: ownOfTarget } });
      await charges.replace(target, { wardIds: [ownOfTarget] }, id.actor);

      expect(await fails(merges.preview(source, id.wVuonLai))).toMatchObject({ status: 409, body: { code: MERGE_ERROR.WARD_CHARGE_TARGET_WARD, details: [{ count: 2 }] } });

      const preview = await merges.preview(source, target);
      expect(preview.summary.moved).toEqual(expect.arrayContaining([{ table: 'team_ward_charges', column: 'managerTeamId', count: 2 }]));
      const { operationId, summary } = await merges.merge(source, target, id.actor);
      expect(summary.moved).toEqual(expect.arrayContaining([{ table: 'team_ward_charges', column: 'managerTeamId', count: 2 }]));
      expect(await wardsOf(target)).toEqual(sorted(id.benThanh, id.vinhHoi, ownOfTarget));
      expect(await wardsOf(source)).toEqual([]);
      // The source was archived by the merge (it holds no charge any more).
      expect((await scratch.db.team.findUniqueOrThrow({ where: { id: source } })).status).toBe('ARCHIVED');

      await merges.undo(operationId, id.actor);
      expect(await wardsOf(source)).toEqual(sorted(id.benThanh, id.vinhHoi));
      expect(await wardsOf(target)).toEqual([ownOfTarget]);
    });
  });
});
