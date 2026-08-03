/**
 * audit-field-coverage.ts — RÀ SOÁT phủ field di trú (pháp lý: không sót field nào).
 *
 * Với mỗi entity (cases/petitions/incidents): liệt kê MỌI key trong legacy_raw có DATA,
 * đánh dấu key nào CHƯA được builder xử lý (không thuộc MAPPED_LEGACY_KEYS) và cũng
 * KHÔNG phải _search/hệ thống → đó là GAP tiềm năng (data có mà chưa surface).
 *
 * Dùng: npx ts-node cli/audit-field-coverage.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { MAPPED_LEGACY_KEYS } from '../legacy-mapper';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

// Key hệ thống / tìm kiếm — cố ý bỏ (không phải nghiệp vụ).
const DROP = (k: string): boolean =>
  /_search$/.test(k) ||
  /^_/.test(k) ||
  ['id', 'da_xoa', 'da_nhan', 'don_vi_id', 'nguoi_them', '__v', 'stt', 'nam', 'thang', 'ngay',
    'add_time', 'update_time', 'loai', 'phan_loai_nguon_tin_ban_dau'].includes(k);

const TABLES: Array<{ table: string; raw: string; label: string }> = [
  { table: 'cases', raw: 'legacy_raw', label: 'VỤ ÁN' },
  { table: 'petitions', raw: '"legacyRaw"', label: 'ĐƠN THƯ' },
  { table: 'incidents', raw: '"legacyRaw"', label: 'VỤ VIỆC' },
];

async function main(): Promise<void> {
  for (const { table, raw, label } of TABLES) {
    // Lấy mọi key + số bản ghi có giá trị (non-empty) cho key đó.
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; n: bigint }>>(
      `SELECT k.key, COUNT(*)::bigint n
       FROM "${table}" t, LATERAL jsonb_object_keys(${raw}) AS k(key)
       WHERE ${raw} IS NOT NULL
         AND COALESCE(${raw}->>k.key,'') <> ''
       GROUP BY k.key`,
    );
    const total = Number(
      (await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint n FROM "${table}" WHERE ${raw} IS NOT NULL`,
      ))[0]?.n ?? 0,
    );
    const gaps = rows
      .filter((r) => !DROP(r.key) && !MAPPED_LEGACY_KEYS.has(r.key))
      .map((r) => ({ key: r.key, n: Number(r.n) }))
      .sort((a, b) => b.n - a.n);

    console.log(`\n===== ${label} (${table}) — ${total} bản ghi di trú =====`);
    if (!gaps.length) {
      console.log('  ✅ KHÔNG có field nguồn nào có data mà chưa nằm trong registry.');
    } else {
      console.log(`  ⚠️  ${gaps.length} field có DATA nhưng CHƯA trong MAPPED_LEGACY_KEYS:`);
      for (const g of gaps) {
        const pct = total ? ((g.n / total) * 100).toFixed(1) : '0';
        console.log(`    ${g.key.padEnd(48)} ${g.n}/${total} (${pct}%)`);
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[audit] LỖI:', e?.message || e);
  process.exit(1);
});
