/**
 * Crawl địa chỉ cũ → mới từ provinces.open-api.vn
 * Output: backend/prisma/data/address-mappings-hcm.json
 *
 * Nguồn: Nghị quyết 1279/NQ-UBTVQH15 (01/07/2025) — cải cách hành chính
 * TPHCM: quận/huyện bị xóa, phường/xã mới mang tên quận/huyện cũ
 *
 * Run: node scripts/crawl-address-mappings.mjs
 * Apply: node scripts/crawl-address-mappings.mjs --apply
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../backend/prisma/data');
const OUT_FILE = join(OUT_DIR, 'address-mappings-hcm.json');

const BASE = 'https://provinces.open-api.vn/api';

// ─── Quy tắc TPHCM: quận/huyện cũ → phường/xã mới ────────────────────────
// Nguồn: Nghị quyết sắp xếp đơn vị hành chính TPHCM 2025
// Mỗi quận/huyện cũ → 1 phường mới mang tên quận/huyện đó
const DISTRICT_TO_NEW_WARD = {
  // Quận có tên riêng
  'quận phú nhuận':  'phường phú nhuận',
  'quận bình thạnh': 'phường bình thạnh',
  'quận gò vấp':     'phường gò vấp',
  'quận tân bình':   'phường tân bình',
  'quận tân phú':    'phường tân phú',
  'quận bình tân':   'phường bình tân',
  // Huyện ngoại thành
  'huyện bình chánh': 'phường bình chánh',
  'huyện hóc môn':   'phường hóc môn',
  'huyện củ chi':    'phường củ chi',
  'huyện nhà bè':    'phường nhà bè',
  'huyện cần giờ':   'phường cần giờ',
  // Quận số — chỉ xóa cấp quận, giữ tên phường
  // (chưa có văn bản chính thức xác nhận tên mới)
  'quận 1': null,
  'quận 2': null,   // nay thuộc TP. Thủ Đức
  'quận 3': null,
  'quận 4': null,
  'quận 5': null,
  'quận 6': null,
  'quận 7': null,
  'quận 8': null,
  'quận 9': null,   // nay thuộc TP. Thủ Đức
  'quận 10': null,
  'quận 11': null,
  'quận 12': null,
  // TP. Thủ Đức (từ Q2, Q9, Q12 cũ — giữ nguyên phường)
  'thành phố thủ đức': null,
};

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PC02-AddressMapper/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log('Fetching TPHCM province data from provinces.open-api.vn...');

  // Fetch TPHCM (province code 79) với tất cả quận/huyện và phường/xã
  const hcmData = await fetchJSON(`${BASE}/p/79?depth=3`);
  const districts = hcmData.districts ?? [];
  console.log(`  Found ${districts.length} quận/huyện in TPHCM`);

  const mappings = [];
  let totalWards = 0;
  let mappedWards = 0;
  let unmappedWards = 0;

  for (const district of districts) {
    const districtNameRaw = district.name; // e.g. "Quận Phú Nhuận"
    const districtKey = districtNameRaw.toLowerCase().trim();
    const newWard = DISTRICT_TO_NEW_WARD[districtKey];

    const wards = district.wards ?? [];
    console.log(`  ${districtNameRaw}: ${wards.length} phường/xã → ${newWard ?? '[giữ nguyên tên phường]'}`);

    for (const ward of wards) {
      const oldWardName = ward.name.toLowerCase().trim(); // e.g. "phường 14"
      const oldDistrictName = districtKey; // e.g. "quận phú nhuận"

      totalWards++;

      if (newWard !== undefined) {
        // Quận có mapping → đổi tên phường
        mappings.push({
          oldWard: oldWardName,
          oldDistrict: oldDistrictName,
          newWard: newWard ?? oldWardName, // null = giữ nguyên tên phường
          province: 'HCM',
          note: newWard
            ? `NQ 1279/NQ-UBTVQH15: ${districtNameRaw} sáp nhập thành ${newWard}`
            : `Chỉ xóa cấp quận (${districtNameRaw}) — tên phường giữ nguyên`,
          needsReview: newWard === null, // quận số cần review
        });
        if (newWard) mappedWards++;
        else unmappedWards++;
      } else {
        // Không trong danh sách (Thủ Đức cũ, v.v.) — skip
        console.log(`    ⚠️  Không có mapping: ${oldWardName}, ${districtKey}`);
      }
    }
  }

  console.log(`\nTotal: ${totalWards} wards`);
  console.log(`  Mapped (tên mới): ${mappedWards}`);
  console.log(`  Needs review (quận số): ${unmappedWards}`);
  console.log(`  Total records: ${mappings.length}`);

  // Write output
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(mappings, null, 2), 'utf-8');
  console.log(`\nWrote ${mappings.length} mappings → ${OUT_FILE}`);

  // Apply to DB if flag --apply
  if (process.argv.includes('--apply')) {
    console.log('\nApplying to DB...');
    await applyToDb(mappings);
  } else {
    console.log('\nRun with --apply to upsert into DB');
    console.log('Or run: npx ts-node prisma/seed-address-mappings.ts');
  }
}

async function applyToDb(mappings) {
  // Dynamic import to avoid requiring prisma in crawl script
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;

  for (const m of mappings) {
    const result = await prisma.addressMapping.upsert({
      where: { oldWard_oldDistrict_province: { oldWard: m.oldWard, oldDistrict: m.oldDistrict, province: m.province } },
      update: { newWard: m.newWard, note: m.note, needsReview: m.needsReview },
      create: m,
    });
    if (result.createdAt.getTime() > Date.now() - 5000) created++;
    else updated++;
  }

  await prisma.$disconnect();
  console.log(`Done: ${created} created, ${updated} updated`);
}

main().catch(e => { console.error(e); process.exit(1); });
