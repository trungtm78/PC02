/**
 * Sinh cây Tổ/Nhóm + đăng ký người dùng từ dữ liệu hệ cũ đã nằm trong bảng chờ.
 *
 * Chạy (sau khi stage.ts đã nạp chi_nhanh, thanh_vien, phan_quyen):
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/seed-org.ts --dry     # chỉ báo cáo
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/seed-org.ts           # ghi thật
 *
 * NGUYÊN TẮC AN TOÀN — không thương lượng:
 *  · KHÔNG sửa, KHÔNG đổi tên, KHÔNG vô hiệu hoá bất kỳ tổ hay tài khoản nào ĐANG CÓ.
 *    Khớp trước, chỉ tạo phần còn thiếu.
 *  · KHÔNG ghi bất kỳ hash mật khẩu nào của hệ cũ — mật khẩu cũ là MD5 KHÔNG salt
 *    (`e10adc39…` chính là MD5("123456")). Tài khoản mới nhận vé kích hoạt dùng một
 *    lần, tự đặt mật khẩu.
 *  · Chạy lại nhiều lần cho cùng kết quả (khớp theo tên chuẩn hoá / tên đăng nhập).
 */
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  teamScopedKey, unitKindOf, teamLevelOf, teamIsActive, teamCodeOf, uniqueCode,
  roleOf, usernameOf, realEmailOf, splitFullName, normalizeVi,
} from './org-mapper';

/** Vé kích hoạt sống 72 giờ, đúng như luồng magic-link sẵn có của hệ thống. */
const ENROLLMENT_TTL_MS = 72 * 60 * 60 * 1000;

interface OrgReport {
  teamsExisting: number;
  teamsCreated: number;
  teamsByKind: Record<string, number>;
  usersExisting: number;
  usersCreated: number;
  usersInactive: number;
  membershipsCreated: number;
  usernameConflicts: string[];
  wardLinked: number;
  wardMissing: string[];
  unmappedUnits: string[];
}

export async function seedOrg(prisma: PrismaClient, dryRun: boolean): Promise<OrgReport> {
  const rep: OrgReport = {
    teamsExisting: 0, teamsCreated: 0, teamsByKind: {},
    usersExisting: 0, usersCreated: 0, usersInactive: 0, membershipsCreated: 0,
    usernameConflicts: [], wardLinked: 0, wardMissing: [], unmappedUnits: [],
  };

  // ── Đọc dữ liệu gốc từ bảng chờ ───────────────────────────────────────────
  const rows = await prisma.legacyStaging.findMany({
    where: { sourceFile: { in: ['chi_nhanh', 'thanh_vien'] } },
    select: { sourceFile: true, sourceId: true, raw: true },
  });
  const units = rows.filter((r) => r.sourceFile === 'chi_nhanh').map((r) => r.raw as Record<string, unknown>);
  const members = rows.filter((r) => r.sourceFile === 'thanh_vien').map((r) => r.raw as Record<string, unknown>);
  if (!units.length) throw new Error('Bảng chờ chưa có chi_nhanh — chạy stage.ts trước.');

  // ── Tổ/Nhóm đang có: khớp theo tên đã chuẩn hoá ───────────────────────────
  const existingTeams = await prisma.team.findMany({ select: { id: true, name: true, code: true, level: true } });
  const teamByKey = new Map(existingTeams.map((t) => [teamScopedKey(t.level, t.name), t.id]));
  const takenCodes = new Set(existingTeams.map((t) => t.code));
  const rootId = teamByKey.get(teamScopedKey(0, 'PC02')) ?? null;

  // Danh mục phường/xã đã seed sẵn — nối để tổ cấp phường có địa bàn.
  const wards = await prisma.directory.findMany({ where: { type: 'WARD' }, select: { id: true, name: true } });
  const wardByKey = new Map<string, string>();
  for (const w of wards) {
    const k = normalizeVi(w.name).replace(/^(phuong|xa|thi tran)\s+/, '');
    if (!wardByKey.has(k)) wardByKey.set(k, w.id);
  }

  // Tạo đơn vị theo thứ tự cấp: gốc → cấp 1 → cấp 2, để cha luôn có trước con.
  const ordered = [...units].sort((a, b) => teamLevelOf(unitKindOf(a.loai_don_vi)) - teamLevelOf(unitKindOf(b.loai_don_vi)));
  const teamIdByLegacyId = new Map<string, string>();

  for (const u of ordered) {
    const name = String(u.ten ?? '').trim();
    const legacyId = String(u.id ?? '');
    if (!name || !legacyId) continue;
    const kind = unitKindOf(u.loai_don_vi);
    if (kind === 'KHAC') rep.unmappedUnits.push(name);
    const level = teamLevelOf(kind);
    const key = teamScopedKey(level, name);

    const found = teamByKey.get(key);
    if (found) {
      rep.teamsExisting++;
      teamIdByLegacyId.set(legacyId, found);
      continue;
    }

    let wardId: string | null = null;
    if (kind === 'PHUONG_XA') {
      const wk = normalizeVi(name).replace(/^cong an\s+/, '').replace(/^(phuong|xa|thi tran)\s+/, '');
      wardId = wardByKey.get(wk) ?? null;
      if (wardId) rep.wardLinked++;
      else rep.wardMissing.push(name);
    }
    const code = uniqueCode(teamCodeOf(u.ten_ngan as string | undefined, name), takenCodes);
    takenCodes.add(code);
    rep.teamsCreated++;
    rep.teamsByKind[kind] = (rep.teamsByKind[kind] ?? 0) + 1;

    if (!dryRun) {
      const created = await prisma.team.create({
        data: {
          name, code, level,
          parentId: level === 0 ? null : rootId,
          isActive: teamIsActive(kind),
          order: Number(u.sap_xep ?? 0) || 0,
          wardId,
        },
        select: { id: true },
      });
      teamByKey.set(key, created.id);
      teamIdByLegacyId.set(legacyId, created.id);
    } else {
      // Chạy thử: ghi id giả để phần đếm "gắn người vào tổ" phản ánh đúng thực tế,
      // thay vì báo 1 chỉ vì tổ chưa tồn tại.
      teamIdByLegacyId.set(legacyId, `DRY-${legacyId}`);
    }
  }

  // ── Người dùng ────────────────────────────────────────────────────────────
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));
  const officerRoleId = roleIdByName.get('OFFICER');
  const adminRoleId = roleIdByName.get('ADMIN');
  if (!officerRoleId || !adminRoleId) throw new Error('Thiếu vai trò OFFICER/ADMIN — chạy npm run db:seed trước.');

  const existingUsers = await prisma.user.findMany({ select: { id: true, username: true } });
  const userIdByName = new Map(existingUsers.map((u) => [u.username.toLowerCase(), u.id]));

  for (const m of members) {
    const username = usernameOf(m);
    if (!username) continue;
    const lower = username.toLowerCase();

    const existing = userIdByName.get(lower);
    if (existing) {
      // Tài khoản trùng tên đăng nhập với người đang dùng thật — KHÔNG ghi đè.
      rep.usersExisting++;
      rep.usernameConflicts.push(username);
      continue;
    }

    const { roleName, canDispatch } = roleOf(m.phan_quyen);
    const isActive = String(m.hoat_dong ?? '1') === '1';
    if (!isActive) rep.usersInactive++;
    const { firstName, lastName } = splitFullName(String(m.ten ?? username));
    rep.usersCreated++;

    if (!dryRun) {
      // Vé kích hoạt dùng một lần; mật khẩu đặt ngẫu nhiên và KHÔNG được phát ra ngoài.
      const token = crypto.randomBytes(32).toString('hex');
      const user = await prisma.user.create({
        data: {
          username,
          email: realEmailOf(m) ?? null,
          passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
          firstName, lastName,
          isActive,
          roleId: roleName === 'ADMIN' ? adminRoleId : officerRoleId,
          canDispatch,
          mustChangePassword: true,
          enrollmentTokenHash: await bcrypt.hash(token, 10),
          enrollmentExpiresAt: new Date(Date.now() + ENROLLMENT_TTL_MS),
          // Hai cột mảng này NOT NULL nhưng không có default ở tầng CSDL — không
          // truyền tường minh là dính NullConstraintViolation ngay bản ghi đầu tiên.
          backupCodes: [],
          backupCodeSalts: [],
        },
        select: { id: true },
      });
      userIdByName.set(lower, user.id);

      const teamId = teamIdByLegacyId.get(String(m.chi_nhanh ?? ''));
      if (teamId) {
        await prisma.userTeam.create({ data: { userId: user.id, teamId } });
        rep.membershipsCreated++;
      }
    } else if (teamIdByLegacyId.has(String(m.chi_nhanh ?? ''))) {
      rep.membershipsCreated++;
    }
  }

  return rep;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    const r = await seedOrg(prisma, dryRun);
    console.log(dryRun ? '\n— CHẠY THỬ, KHÔNG GHI GÌ —\n' : '\n— ĐÃ GHI —\n');
    console.log(`Tổ/Nhóm: ${r.teamsExisting} đã có (giữ nguyên) · ${r.teamsCreated} tạo mới`);
    console.log('  theo loại:', JSON.stringify(r.teamsByKind));
    console.log(`  nối địa bàn phường/xã: ${r.wardLinked} nối được, ${r.wardMissing.length} không tìm thấy trong danh mục`);
    if (r.wardMissing.length) console.log('   ví dụ:', r.wardMissing.slice(0, 5).join(' | '));
    if (r.unmappedUnits.length) console.log('  đơn vị không rõ loại:', r.unmappedUnits.join(' | '));
    console.log(`Người dùng: ${r.usersCreated} tạo mới · ${r.usersExisting} trùng tên đăng nhập (BỎ QUA, không ghi đè)`);
    console.log(`  trong đó ${r.usersInactive} tài khoản đã nghỉ → isActive=false`);
    console.log(`  gắn vào tổ: ${r.membershipsCreated}`);
    if (r.usernameConflicts.length) console.log('  tên đăng nhập trùng:', r.usernameConflicts.slice(0, 10).join(' | '));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
