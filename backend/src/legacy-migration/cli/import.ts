/**
 * Nạp hồ sơ từ bảng chờ vào bảng vận hành.
 *
 * Chạy (sau preflight):
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/import.ts --year 2026   # nạp riêng năm mới nhất
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/import.ts               # nạp tất cả, MỚI NHẤT TRƯỚC
 *
 * Thứ tự nạp là năm GIẢM DẦN, cố ý: hồ sơ 2026 (9.898) là nhóm cán bộ đang dùng hằng
 * ngày. Nếu phải dừng giữa chừng thì phần quan trọng nhất đã nằm trong hệ thống, phần
 * 2016-2020 chủ yếu để tra cứu có thể nạp sau.
 *
 * Bảng tra cứu (người dùng, tổ, tội danh) nạp MỘT LẦN vào bộ nhớ. Cách cũ tra CSDL cho
 * từng bản ghi tốn khoảng 430.000 lượt đi-về cho một lần chạy.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LegacyMigrationService } from '../legacy-migration.service';
import type { LegacyRecord } from '../legacy-mapper';
import { normalizeVi } from './org-mapper';

const DEFAULT_BATCH = 500;

interface ImportOptions {
  year?: string;
  batchSize: number;
  limit?: number;
  actorId: string;
}

interface Lookups {
  /** id người dùng hệ cũ (`thanh_vien.id`) → id người dùng hệ mới */
  userByLegacyId: Map<string, string>;
  /** giá trị đơn vị đã chuẩn hoá → id tổ (chỉ nhóm TEAM đã phân loại) */
  teamByUnitValue: Map<string, string>;
}

export async function loadLookups(prisma: PrismaClient): Promise<Lookups> {
  // Người dùng: nối qua tên đăng nhập, vì bộ đăng ký tài khoản đã dùng chính
  // `thanh_vien.email` (thực chất là tên đăng nhập) làm `username`.
  const members = await prisma.legacyStaging.findMany({
    where: { sourceFile: 'thanh_vien' },
    select: { sourceId: true, raw: true },
  });
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const userIdByName = new Map(users.map((u) => [u.username.toLowerCase(), u.id]));
  const userByLegacyId = new Map<string, string>();
  for (const m of members) {
    const raw = m.raw as Record<string, unknown>;
    for (const k of ['email', 'so_dt', 'ten']) {
      const v = String(raw[k] ?? '').trim().toLowerCase();
      const id = v ? userIdByName.get(v) : undefined;
      if (id) {
        userByLegacyId.set(m.sourceId, id);
        break;
      }
    }
  }

  const aliases = await prisma.legacyUnitAlias.findMany({
    where: { kind: 'TEAM', teamId: { not: null } },
    select: { rawValue: true, teamId: true },
  });
  const teamByUnitValue = new Map(aliases.map((a) => [a.rawValue, a.teamId as string]));

  return { userByLegacyId, teamByUnitValue };
}

/**
 * Gắn chủ sở hữu + tổ vào bản ghi trước khi đưa qua bộ ánh xạ.
 *
 * `nguoi_them` khớp `thanh_vien.id` 100,00% trên toàn bộ 53.820 hồ sơ (0 mồ côi), nên
 * đây là căn cứ đáng tin để gán người. Không tra được thì để TRỐNG, không gán bừa.
 */
export function attachOwnership(rec: LegacyRecord, lk: Lookups): LegacyRecord {
  const ownerId = rec.nguoi_them == null ? '' : String(rec.nguoi_them).trim();
  const userId = ownerId ? lk.userByLegacyId.get(ownerId) : undefined;
  const unitRaw = String(rec.don_vi_giai_quyet ?? '').trim();
  const teamId = unitRaw ? lk.teamByUnitValue.get(normalizeVi(unitRaw)) : undefined;
  return {
    ...rec,
    __enteredById: userId,
    __createdById: userId,
    __investigatorId: userId,
    __assignedTeamId: teamId,
  };
}

async function main(): Promise<void> {
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const opts: ImportOptions = {
    year: arg('year'),
    batchSize: Number(arg('batch') ?? DEFAULT_BATCH),
    limit: arg('limit') ? Number(arg('limit')) : undefined,
    actorId: arg('actor') ?? '',
  };

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    // Người chạy di trú được ghi vào importedById của mọi bản ghi. Mặc định lấy một ADMIN.
    let actorId = opts.actorId;
    if (!actorId) {
      const admin = await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } }, select: { id: true } });
      if (!admin) throw new Error('Không tìm thấy tài khoản ADMIN để ghi nhận người chạy di trú.');
      actorId = admin.id;
    }

    const lk = await loadLookups(prisma);
    console.log(`Bảng tra cứu: ${lk.userByLegacyId.size} người dùng, ${lk.teamByUnitValue.size} giá trị đơn vị → tổ`);

    // Lấy id theo thứ tự năm GIẢM DẦN. Chỉ kéo id trước để không giữ 53.820 bản ghi
    // JSONB trong RAM cùng lúc.
    const idRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM legacy_staging
       WHERE "sourceFile" IN ('ho_so_doi_1','ho_so')
       ${opts.year ? `AND raw->>'nam' = '${opts.year.replace(/'/g, "''")}'` : ''}
       ORDER BY NULLIF(regexp_replace(COALESCE(raw->>'nam',''), '\\D', '', 'g'), '')::int DESC NULLS LAST,
                (raw->>'id')::text DESC
       ${opts.limit ? `LIMIT ${Number(opts.limit)}` : ''}`,
    );
    console.log(`Sẽ nạp ${idRows.length} hồ sơ${opts.year ? ` của năm ${opts.year}` : ' (mới nhất trước)'}\n`);

    const service = new LegacyMigrationService(prisma as never, { log: async () => undefined } as never);
    const total = { petitions: 0, incidents: 0, cases: 0, guidance: 0, exchanges: 0, proposals: 0, lawyers: 0 };
    let skipped = 0;
    let errors = 0;
    const t0 = Date.now();

    for (let i = 0; i < idRows.length; i += opts.batchSize) {
      const ids = idRows.slice(i, i + opts.batchSize).map((r) => r.id);
      const rows = await prisma.legacyStaging.findMany({
        where: { id: { in: ids } },
        select: { sourceFile: true, raw: true },
      });
      const records: LegacyRecord[] = rows.map((r) =>
        attachOwnership({ ...(r.raw as LegacyRecord), __sourceCollection: r.sourceFile }, lk),
      );

      const res = await service.commit(records, actorId);
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += res.created[k];
      skipped += res.skipped;
      errors += res.errors.length;

      // Bản ghi bị chặn được ghi lại để đếm được, thay vì biến mất trong log.
      if (res.errors.length) {
        await prisma.legacyImportError.createMany({
          data: res.errors.map((e) => ({
            runId: 'import',
            sourceFile: 'ho_so_doi_1',
            sourceId: e.legacyId,
            reason: e.message.split(':')[0],
            detail: { message: e.message },
          })),
          skipDuplicates: true,
        });
      }

      const done = Math.min(i + opts.batchSize, idRows.length);
      process.stdout.write(
        `\r  ${done}/${idRows.length} hồ sơ · đơn thư ${total.petitions} · vụ việc ${total.incidents} · vụ án ${total.cases} · bỏ qua ${skipped} · lỗi ${errors}   `,
      );
    }

    console.log(`\n\nXong trong ${((Date.now() - t0) / 1000).toFixed(1)} giây.`);
    console.log('Đã tạo:', JSON.stringify(total));
    console.log(`Bỏ qua ${skipped} · lỗi ${errors} (xem bảng legacy_import_errors)`);
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
