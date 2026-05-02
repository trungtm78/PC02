/**
 * Fetch toàn bộ phường/xã từ provinces.open-api.vn
 * và generate frontend/src/data/vietnam-wards.ts + wards-full.json
 *
 * Run: node scripts/fetch-wards.mjs
 *
 * Nguồn: provinces.open-api.vn (community API, dữ liệu cấu trúc cũ 63 tỉnh)
 * Script map toàn bộ 63 tỉnh cũ → 34 tỉnh/TP mới (Nghị quyết 1279/NQ-UBTVQH15)
 *
 * Các lỗi đã sửa so với script cũ:
 *   - Code 19 (Thái Nguyên) bị thiếu → TN ✓
 *   - Code 27 (Bắc Ninh) bị thiếu → HN ✓
 *   - Code 37 (Ninh Bình) bị thiếu → NB ✓
 *   - Code 68 (Lâm Đồng) bị map sai thành AG → LDG ✓
 *   - Code 70 (Bình Phước) bị thiếu → BP ✓
 *   - Code 75 (Đồng Nai) bị map sai thành BP → DNA ✓
 *   - Code 91 (Kiên Giang) bị thiếu → AG ✓
 *   - Nhiều conflict khi cùng key trong object → dùng Map để tránh ✓
 */

import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_TS   = join(__dirname, '../frontend/src/data/vietnam-wards.ts');
const OUT_JSON = join(__dirname, '../frontend/src/data/wards-full.json');

const BASE = 'https://provinces.open-api.vn/api';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ─── Mapping: mã tỉnh API (cũ, 63 tỉnh) → tỉnh/TP mới (34 đơn vị) ──────────
//
// Nguồn: Nghị quyết 1279/NQ-UBTVQH15 ngày 21/11/2024
//        "Về sắp xếp đơn vị hành chính cấp tỉnh giai đoạn 2023-2025"
//        Hiệu lực: 01/07/2025
//
// Cấu trúc: apiCode → { code, name }
// apiCode: mã số tỉnh trong provinces.open-api.vn (khớp mã GSO cũ)
//
const PROVINCE_MAP = new Map([
  // ── Hà Nội (HN) — giữ nguyên + nhận Bắc Ninh ─────────────────────────────
  [ 1,  { code: 'HN',  name: 'Hà Nội' }],           // Hà Nội
  [27,  { code: 'HN',  name: 'Hà Nội' }],           // Bắc Ninh → Hà Nội

  // ── TP Hồ Chí Minh (HCM) — nhận Bình Dương + BRVT ───────────────────────
  [79,  { code: 'HCM', name: 'Thành phố Hồ Chí Minh' }], // TPHCM
  [74,  { code: 'HCM', name: 'Thành phố Hồ Chí Minh' }], // Bình Dương → HCM
  [77,  { code: 'HCM', name: 'Thành phố Hồ Chí Minh' }], // Bà Rịa-Vũng Tàu → HCM

  // ── Đà Nẵng (DN) — nhận Quảng Nam ───────────────────────────────────────
  [48,  { code: 'DN',  name: 'Đà Nẵng' }],          // Đà Nẵng
  [49,  { code: 'DN',  name: 'Đà Nẵng' }],          // Quảng Nam → Đà Nẵng

  // ── Hải Phòng (HP) — nhận Hải Dương ─────────────────────────────────────
  [31,  { code: 'HP',  name: 'Hải Phòng' }],        // Hải Phòng
  [30,  { code: 'HP',  name: 'Hải Phòng' }],        // Hải Dương → Hải Phòng

  // ── Cần Thơ (CT) — nhận Hậu Giang + Sóc Trăng ───────────────────────────
  [92,  { code: 'CT',  name: 'Cần Thơ' }],          // Cần Thơ
  [93,  { code: 'CT',  name: 'Cần Thơ' }],          // Hậu Giang → Cần Thơ
  [94,  { code: 'CT',  name: 'Cần Thơ' }],          // Sóc Trăng → Cần Thơ

  // ── Huế (HUE) — Thừa Thiên Huế lên thành phố trực thuộc TW ───────────────
  [46,  { code: 'HUE', name: 'Huế' }],              // Thừa Thiên Huế → Huế

  // ── An Giang (AG) — nhận Kiên Giang ──────────────────────────────────────
  [89,  { code: 'AG',  name: 'An Giang' }],         // An Giang
  [91,  { code: 'AG',  name: 'An Giang' }],         // Kiên Giang → An Giang

  // ── Bình Phước (BP) — giữ nguyên ─────────────────────────────────────────
  [70,  { code: 'BP',  name: 'Bình Phước' }],       // Bình Phước

  // ── Cà Mau (CM) — nhận Bạc Liêu ─────────────────────────────────────────
  [96,  { code: 'CM',  name: 'Cà Mau' }],           // Cà Mau
  [95,  { code: 'CM',  name: 'Cà Mau' }],           // Bạc Liêu → Cà Mau

  // ── Cao Bằng (CB) — nhận Lạng Sơn ───────────────────────────────────────
  [ 4,  { code: 'CB',  name: 'Cao Bằng' }],         // Cao Bằng
  [20,  { code: 'CB',  name: 'Cao Bằng' }],         // Lạng Sơn → Cao Bằng

  // ── Điện Biên (DB) — nhận Lai Châu + Sơn La ─────────────────────────────
  [11,  { code: 'DB',  name: 'Điện Biên' }],        // Điện Biên
  [12,  { code: 'DB',  name: 'Điện Biên' }],        // Lai Châu → Điện Biên
  [14,  { code: 'DB',  name: 'Điện Biên' }],        // Sơn La → Điện Biên

  // ── Đắk Lắk (DLK) — giữ nguyên ──────────────────────────────────────────
  [66,  { code: 'DLK', name: 'Đắk Lắk' }],         // Đắk Lắk

  // ── Đồng Tháp (DT) — nhận Tiền Giang ────────────────────────────────────
  [87,  { code: 'DT',  name: 'Đồng Tháp' }],       // Đồng Tháp
  [82,  { code: 'DT',  name: 'Đồng Tháp' }],       // Tiền Giang → Đồng Tháp

  // ── Đồng Nai (DNA) — giữ nguyên ──────────────────────────────────────────
  [75,  { code: 'DNA', name: 'Đồng Nai' }],         // Đồng Nai (cũ map sai thành BP!)

  // ── Gia Lai (GL) — nhận Kon Tum ──────────────────────────────────────────
  [64,  { code: 'GL',  name: 'Gia Lai' }],          // Gia Lai
  [62,  { code: 'GL',  name: 'Gia Lai' }],          // Kon Tum → Gia Lai

  // ── Hưng Yên (HY) — nhận Thái Bình ──────────────────────────────────────
  [33,  { code: 'HY',  name: 'Hưng Yên' }],         // Hưng Yên
  [34,  { code: 'HY',  name: 'Hưng Yên' }],         // Thái Bình → Hưng Yên

  // ── Khánh Hòa (KH) — nhận Phú Yên ───────────────────────────────────────
  [56,  { code: 'KH',  name: 'Khánh Hòa' }],        // Khánh Hòa
  [54,  { code: 'KH',  name: 'Khánh Hòa' }],        // Phú Yên → Khánh Hòa

  // ── Lào Cai (LCI) — nhận Yên Bái ────────────────────────────────────────
  [10,  { code: 'LCI', name: 'Lào Cai' }],          // Lào Cai
  [15,  { code: 'LCI', name: 'Lào Cai' }],          // Yên Bái → Lào Cai

  // ── Lâm Đồng (LDG) — nhận Đắk Nông + Bình Thuận ─────────────────────────
  [68,  { code: 'LDG', name: 'Lâm Đồng' }],         // Lâm Đồng (cũ map sai thành AG!)
  [67,  { code: 'LDG', name: 'Lâm Đồng' }],         // Đắk Nông → Lâm Đồng
  [60,  { code: 'LDG', name: 'Lâm Đồng' }],         // Bình Thuận → Lâm Đồng

  // ── Long An (LA) — giữ nguyên ────────────────────────────────────────────
  [80,  { code: 'LA',  name: 'Long An' }],           // Long An

  // ── Nghệ An (NAN) — nhận Hà Tĩnh ────────────────────────────────────────
  [40,  { code: 'NAN', name: 'Nghệ An' }],           // Nghệ An
  [42,  { code: 'NAN', name: 'Nghệ An' }],           // Hà Tĩnh → Nghệ An

  // ── Ninh Bình (NB) — nhận Hà Nam + Nam Định ──────────────────────────────
  [37,  { code: 'NB',  name: 'Ninh Bình' }],         // Ninh Bình (cũ bị thiếu hoàn toàn!)
  [35,  { code: 'NB',  name: 'Ninh Bình' }],         // Hà Nam → Ninh Bình
  [36,  { code: 'NB',  name: 'Ninh Bình' }],         // Nam Định → Ninh Bình

  // ── Ninh Thuận (NT) — giữ nguyên ─────────────────────────────────────────
  [58,  { code: 'NT',  name: 'Ninh Thuận' }],        // Ninh Thuận

  // ── Phú Thọ (PT) — nhận Vĩnh Phúc + Hòa Bình ────────────────────────────
  [25,  { code: 'PT',  name: 'Phú Thọ' }],           // Phú Thọ
  [26,  { code: 'PT',  name: 'Phú Thọ' }],           // Vĩnh Phúc → Phú Thọ
  [17,  { code: 'PT',  name: 'Phú Thọ' }],           // Hòa Bình → Phú Thọ

  // ── Quảng Bình (QB) — nhận Quảng Trị ────────────────────────────────────
  [44,  { code: 'QB',  name: 'Quảng Bình' }],        // Quảng Bình
  [45,  { code: 'QB',  name: 'Quảng Bình' }],        // Quảng Trị → Quảng Bình

  // ── Quảng Ngãi (QN) — nhận Bình Định ────────────────────────────────────
  [51,  { code: 'QN',  name: 'Quảng Ngãi' }],        // Quảng Ngãi
  [52,  { code: 'QN',  name: 'Quảng Ngãi' }],        // Bình Định → Quảng Ngãi

  // ── Quảng Ninh (QNI) — giữ nguyên ───────────────────────────────────────
  [22,  { code: 'QNI', name: 'Quảng Ninh' }],        // Quảng Ninh

  // ── Thanh Hóa (TH) — giữ nguyên ─────────────────────────────────────────
  [38,  { code: 'TH',  name: 'Thanh Hóa' }],         // Thanh Hóa

  // ── Thái Nguyên (TN) — nhận Bắc Kạn + Bắc Giang ─────────────────────────
  [19,  { code: 'TN',  name: 'Thái Nguyên' }],       // Thái Nguyên (cũ bị thiếu!)
  [ 6,  { code: 'TN',  name: 'Thái Nguyên' }],       // Bắc Kạn → Thái Nguyên
  [24,  { code: 'TN',  name: 'Thái Nguyên' }],       // Bắc Giang → Thái Nguyên

  // ── Tuyên Quang (TQ) — nhận Hà Giang ────────────────────────────────────
  [ 8,  { code: 'TQ',  name: 'Tuyên Quang' }],       // Tuyên Quang
  [ 2,  { code: 'TQ',  name: 'Tuyên Quang' }],       // Hà Giang → Tuyên Quang

  // ── Tây Ninh (TYN) — giữ nguyên ──────────────────────────────────────────
  [72,  { code: 'TYN', name: 'Tây Ninh' }],          // Tây Ninh

  // ── Vĩnh Long (VL) — nhận Bến Tre + Trà Vinh ────────────────────────────
  [86,  { code: 'VL',  name: 'Vĩnh Long' }],         // Vĩnh Long
  [83,  { code: 'VL',  name: 'Vĩnh Long' }],         // Bến Tre → Vĩnh Long
  [84,  { code: 'VL',  name: 'Vĩnh Long' }],         // Trà Vinh → Vĩnh Long
]);

// Priority order for display (TPHCM đầu, HN hai, các TP lớn, rồi tỉnh)
const PROVINCE_PRIORITY = ['HCM', 'HN', 'DN', 'HP', 'CT', 'HUE'];

async function main() {
  console.log('Fetching provinces from provinces.open-api.vn...');
  const provinces = await fetchJSON(`${BASE}/p/`);
  console.log(`  Got ${provinces.length} provinces (old 63-province structure)`);

  // Verify all provinces are mapped — exit(1) if any are missing to prevent silent P-code data
  const unmapped = provinces.filter(p => !PROVINCE_MAP.has(p.code));
  if (unmapped.length > 0) {
    console.error(`\n❌ ERROR: ${unmapped.length} province(s) not in PROVINCE_MAP:`);
    unmapped.forEach(p => console.error(`   Code ${p.code}: ${p.name}`));
    console.error('\nFix PROVINCE_MAP in fetch-wards.mjs before running again.');
    console.error('These provinces would generate fallback P{code} entries in the output.\n');
    process.exit(1);
  }
  console.log(`  ✅ All ${provinces.length} provinces correctly mapped to 34 new tỉnh/TP`);

  // Build district → province mapping
  console.log('Building district→province mapping...');
  const districtToProvince = new Map();
  for (const p of provinces) {
    const pFull = await fetchJSON(`${BASE}/p/${p.code}?depth=2`);
    for (const d of pFull.districts || []) {
      districtToProvince.set(d.code, p.code);
    }
    process.stdout.write('.');
  }
  console.log(`\n  District→Province map built (${districtToProvince.size} districts)`);

  console.log('Fetching all wards...');
  const wards = await fetchJSON(`${BASE}/w/`);
  console.log(`  Got ${wards.length} wards from API`);

  // Transform wards
  const transformed = [];
  const seenCodes = new Set();
  let unmappedCount = 0;

  for (const w of wards) {
    const oldProvinceCode = districtToProvince.get(w.district_code);

    // Look up new province from map
    const provinceInfo = PROVINCE_MAP.get(oldProvinceCode);

    if (!provinceInfo) {
      unmappedCount++;
      if (unmappedCount <= 10) {
        console.warn(`  ⚠️  Ward ${w.name} in district ${w.district_code} has no province mapping (old: ${oldProvinceCode})`);
      }
      // Fallback: use P{code} if no mapping found
      const fallbackCode = `P${oldProvinceCode}`;
      const fallbackInfo = { code: fallbackCode, name: `Tỉnh ${oldProvinceCode}` };
      const slug = w.codename.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
      const code = `${fallbackCode}_${w.code}_${slug.slice(0, 15)}`;
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        transformed.push({
          code, name: w.name,
          type: mapWardType(w.division_type),
          provinceCode: fallbackInfo.code,
          province: fallbackInfo.name,
          _sort: 999, _apiCode: w.code,
        });
      }
      continue;
    }

    // Generate unique ward code: {PROVINCE}_{apiCode}_{slug}
    const slug = w.codename.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
    const code = `${provinceInfo.code}_${w.code}_${slug.slice(0, 15)}`;

    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    transformed.push({
      code,
      name: w.name,
      type: mapWardType(w.division_type),
      provinceCode: provinceInfo.code,
      province: provinceInfo.name,
      _sort: PROVINCE_PRIORITY.includes(provinceInfo.code)
        ? PROVINCE_PRIORITY.indexOf(provinceInfo.code)
        : 999,
      _apiCode: w.code,
    });
  }

  if (unmappedCount > 10) {
    console.error(`  ❌ Total unmapped wards: ${unmappedCount} (check district→province mapping)`);
  }

  // Sort: TPHCM first, then other priority provinces, then rest alphabetically
  transformed.sort((a, b) => {
    if (a._sort !== b._sort) return a._sort - b._sort;
    if (a.provinceCode !== b.provinceCode) return a.provinceCode.localeCompare(b.provinceCode);
    return a.name.localeCompare(b.name, 'vi');
  });

  console.log(`\nTransformed ${transformed.length} wards`);

  // Count by province
  const counts = {};
  for (const w of transformed) {
    counts[w.provinceCode] = (counts[w.provinceCode] || 0) + 1;
  }
  const topProvinces = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  console.log('Top provinces:', topProvinces);

  // Verify TPHCM count (should include Bình Dương + BRVT wards)
  const hcmCount = counts['HCM'] || 0;
  const hnCount = counts['HN'] || 0;
  console.log(`TPHCM: ${hcmCount} wards (bao gồm cả Bình Dương + BRVT sau sáp nhập)`);
  console.log(`Hà Nội: ${hnCount} wards (bao gồm Bắc Ninh)`);

  // Write wards-full.json (all wards, for lazy load / DB seed)
  const jsonData = transformed.map(({ _sort, _apiCode, ...w }) => w);
  writeFileSync(OUT_JSON, JSON.stringify(jsonData, null, 0), 'utf-8');
  console.log(`\nWrote wards-full.json: ${(readFileSync(OUT_JSON).length / 1024).toFixed(0)} KB (${jsonData.length} wards)`);

  // Write vietnam-wards.ts (Tier 1: priority provinces for immediate load)
  const TIER1_PROVINCES = new Set(['HCM', 'HN', 'DN', 'HP', 'CT', 'HUE']);
  const tier1 = transformed.filter(w => TIER1_PROVINCES.has(w.provinceCode));
  console.log(`Tier 1 (major cities): ${tier1.length} wards`);

  const header = `/**
 * Danh sách phường/xã toàn quốc Vietnam — Tier 1 (TPHCM + 5 TP lớn)
 * Nguồn: provinces.open-api.vn (dữ liệu cấu trúc cũ), map sang 34 tỉnh/TP mới
 * Nghị quyết 1279/NQ-UBTVQH15 — hiệu lực 01/07/2025
 *
 * Tier 1: ${tier1.length} đơn vị (TPHCM + HN + ĐN + HP + CT + Huế) — load ngay
 * Tier 2: Full data tại wards-full.json (${jsonData.length} đơn vị) — lazy load
 * Generated: ${new Date().toISOString()}
 * Run: node scripts/fetch-wards.mjs
 */

export interface Ward {
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  province: string;
}

`;

  const arrLines = ['export const VIETNAM_WARDS: Ward[] = ['];
  let lastProv = '';
  for (const w of tier1) {
    if (w.provinceCode !== lastProv) {
      arrLines.push(`  // ── ${w.province} (${w.provinceCode}) ──`);
      lastProv = w.provinceCode;
    }
    arrLines.push(`  { code: ${JSON.stringify(w.code)}, name: ${JSON.stringify(w.name)}, type: '${w.type}', provinceCode: '${w.provinceCode}', province: ${JSON.stringify(w.province)} },`);
  }
  arrLines.push('];', '');

  const helpers = `/** Chỉ phường/xã TPHCM (bao gồm Bình Dương + BRVT sau sáp nhập) */
export const HCMC_WARDS = VIETNAM_WARDS.filter(w => w.provinceCode === 'HCM');

/** Lấy phường/xã theo tỉnh (Tier 1 only — major cities) */
export function getWardsByProvince(provinceCode: string): Ward[] {
  return VIETNAM_WARDS.filter(w => w.provinceCode === provinceCode);
}

/** Tìm kiếm phường/xã (Tier 1 — TPHCM ưu tiên) */
export function searchWards(query: string, limit = 20): Ward[] {
  if (!query.trim()) return HCMC_WARDS.slice(0, limit);
  const q = query.toLowerCase().trim();
  return VIETNAM_WARDS
    .filter(w => w.name.toLowerCase().includes(q))
    .slice(0, limit);
}

/** Tên phường/xã để dùng trong autocomplete (TPHCM đầu) */
export const WARD_NAMES_HCM_FIRST: string[] = VIETNAM_WARDS.map(w => w.name);

/**
 * Load toàn bộ ${jsonData.length} phường/xã từ wards-full.json (lazy load)
 */
export async function loadFullWards(): Promise<Ward[]> {
  const data = await import('./wards-full.json');
  return data.default as Ward[];
}

/** Tìm kiếm toàn quốc (lazy load full data) */
export async function searchWardsFullCountry(query: string, limit = 20): Promise<Ward[]> {
  if (!query.trim()) return HCMC_WARDS.slice(0, limit);
  const all = await loadFullWards();
  const q = query.toLowerCase().trim();
  const hcm = all.filter(w => w.provinceCode === 'HCM' && w.name.toLowerCase().includes(q));
  const other = all.filter(w => w.provinceCode !== 'HCM' && w.name.toLowerCase().includes(q));
  return [...hcm, ...other].slice(0, limit);
}
`;

  writeFileSync(OUT_TS, header + arrLines.join('\n') + '\n' + helpers, 'utf-8');
  console.log(`Wrote vietnam-wards.ts: ${(readFileSync(OUT_TS).length / 1024).toFixed(0)} KB`);
  console.log('\n✅ Done! Run next: node scripts/split-wards.mjs (if needed)');
  console.log('Then: cd backend && npm run db:seed:wards');
}

function mapWardType(divisionType) {
  if (divisionType === 'phường') return 'phuong';
  if (divisionType === 'xã') return 'xa';
  if (divisionType === 'đặc khu') return 'dac_khu';
  return 'xa'; // thị trấn, others → xa after 2025 reform
}

main().catch(e => { console.error(e); process.exit(1); });
