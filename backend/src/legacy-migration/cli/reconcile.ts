/**
 * Đối chiếu SAU khi nạp: so tổng nghiệp vụ giữa bảng chờ (nguồn) và bảng vận hành (đích).
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/reconcile.ts
 *
 * "Mở một hồ sơ trong giao diện thấy đúng" KHÔNG phải là kiểm chứng. Kiểm chứng là:
 * đếm theo năm, theo loại, theo tổ ở hai đầu rồi so; và khẳng định không hồ sơ nào
 * mang ngày bịa.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

interface Row { k: string; n: bigint }

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    console.log('\n═══ ĐỐI CHIẾU SAU KHI NẠP ═══\n');

    // ── 1. Tổng số ────────────────────────────────────────────────────────
    const staged = await prisma.legacyStaging.count({ where: { sourceFile: { in: ['ho_so_doi_1', 'ho_so'] } } });
    const [pt, inc, cs, gd, ex, pr, lw] = await Promise.all([
      prisma.petition.count({ where: { legacySourceId: { not: null } } }),
      prisma.incident.count({ where: { legacySourceId: { not: null } } }),
      prisma.case.count({ where: { legacySourceId: { not: null } } }),
      prisma.guidanceRecord.count({ where: { legacySourceId: { not: null } } }),
      prisma.exchange.count({ where: { legacySourceId: { not: null } } }),
      prisma.proposal.count({ where: { legacySourceId: { not: null } } }),
      prisma.lawyer.count({ where: { legacySourceId: { not: null } } }),
    ]);
    const errs = await prisma.legacyImportError.count();
    console.log(`Nguồn (bảng chờ)      : ${staged} hồ sơ`);
    console.log(`Đích  (đã tạo)        : ${pt} đơn thư · ${inc} vụ việc · ${cs} vụ án · ${gd} hướng dẫn · ${ex} trao đổi · ${pr} kiến nghị · ${lw} luật sư`);
    console.log(`Bản ghi bị chặn       : ${errs} (bảng legacy_import_errors)\n`);

    // ── 2. Không có hồ sơ nào mang ngày bịa ───────────────────────────────
    // Trước bản vá, hồ sơ thiếu ngày bị gán NGÀY CHẠY DI TRÚ. Dấu hiệu: cụm lớn
    // đơn thư có receivedDate đúng bằng ngày hôm nay.
    const today = await prisma.$queryRaw<Row[]>`
      SELECT 'don thu co ngay = hom nay' AS k, count(*)::bigint AS n
      FROM petitions WHERE "legacySourceId" IS NOT NULL AND "receivedDate"::date = CURRENT_DATE`;
    const fabricated = Number(today[0]?.n ?? 0);
    console.log(`${fabricated === 0 ? '✅' : '⛔'} Hồ sơ mang ngày chạy di trú: ${fabricated} (phải bằng 0 — xem P1-3)\n`);

    // ── 3. Theo năm: nguồn vs đích ────────────────────────────────────────
    const src = await prisma.$queryRaw<Row[]>`
      SELECT COALESCE(raw->>'nam','(trống)') AS k, count(*)::bigint AS n
      FROM legacy_staging WHERE "sourceFile" IN ('ho_so_doi_1','ho_so') GROUP BY 1`;
    const dst = await prisma.$queryRaw<Row[]>`
      SELECT EXTRACT(YEAR FROM "receivedDate")::text AS k, count(*)::bigint AS n
      FROM petitions WHERE "legacySourceId" IS NOT NULL GROUP BY 1`;
    const srcMap = new Map(src.map((r) => [r.k, Number(r.n)]));
    const dstMap = new Map(dst.map((r) => [r.k, Number(r.n)]));
    console.log('Theo năm (nguồn = mọi loại hồ sơ, đích = riêng đơn thư nên thấp hơn là bình thường):');
    for (const y of [...srcMap.keys()].sort().reverse().slice(0, 12)) {
      console.log(`   ${y.padStart(8)}: nguồn ${String(srcMap.get(y)).padStart(6)} · đơn thư ${String(dstMap.get(y) ?? 0).padStart(6)}`);
    }

    // ── 4. Phạm vi nhìn thấy ──────────────────────────────────────────────
    const L = { legacySourceId: { not: null } };
    const [ptOwner, ptTeam, csInv, csTeam, incInv, incTeam] = await Promise.all([
      prisma.petition.count({ where: { ...L, enteredById: { not: null } } }),
      prisma.petition.count({ where: { ...L, assignedTeamId: { not: null } } }),
      prisma.case.count({ where: { ...L, investigatorId: { not: null } } }),
      prisma.case.count({ where: { ...L, assignedTeamId: { not: null } } }),
      prisma.incident.count({ where: { ...L, investigatorId: { not: null } } }),
      prisma.incident.count({ where: { ...L, assignedTeamId: { not: null } } }),
    ]);
    const pct = (a: number, b: number) => `${((100 * a) / (b || 1)).toFixed(1)}%`;
    console.log('\nPhạm vi nhìn thấy (không gắn ai thì cán bộ tổ KHÔNG thấy hồ sơ):');
    console.log(`   đơn thư : ${pct(ptOwner, pt)} có người nhập · ${pct(ptTeam, pt)} có tổ`);
    console.log(`   vụ việc : ${pct(incInv, inc)} có điều tra viên · ${pct(incTeam, inc)} có tổ`);
    console.log(`   vụ án   : ${pct(csInv, cs)} có điều tra viên · ${pct(csTeam, cs)} có tổ`);

    // ── 5. Tội danh ───────────────────────────────────────────────────────
    const crimeStat = await prisma.$queryRaw<Row[]>`
      SELECT 'don thu co toi danh' AS k, count(*)::bigint AS n FROM petitions
      WHERE "legacySourceId" IS NOT NULL AND "crimeChinhId" IS NOT NULL`;
    console.log(`\nTội danh: ${crimeStat[0]?.n ?? 0} đơn thư tra được tội danh chính`);

    // ── 6. Top tổ theo số hồ sơ ───────────────────────────────────────────
    const byTeam = await prisma.$queryRaw<{ name: string; n: bigint }[]>`
      SELECT t.name, count(*)::bigint AS n
      FROM petitions p JOIN teams t ON t.id = p."assignedTeamId"
      WHERE p."legacySourceId" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`;
    console.log('\nTổ nhận nhiều đơn thư nhất:');
    for (const r of byTeam) console.log(`   ${String(r.n).padStart(6)}  ${r.name}`);

    console.log('');
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
