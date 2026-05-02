/**
 * Fetch toàn bộ phường/xã từ provinces.open-api.vn
 * và generate frontend/src/data/vietnam-wards.ts
 *
 * Run: node scripts/fetch-wards.mjs
 *
 * API source: https://provinces.open-api.vn
 * Note: API dùng cấu trúc cũ (quận/huyện) nhưng data phường/xã vẫn chính xác.
 *       Script map sang cấu trúc mới: Tỉnh/TP → Phường/Xã (không có cấp trung gian).
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '../frontend/src/data/vietnam-wards.ts');

const BASE = 'https://provinces.open-api.vn/api';

// Mã tỉnh/TP trong API
const HCM_CODE = 79; // TP Hồ Chí Minh
const HN_CODE  = 1;  // Hà Nội
const DN_CODE  = 48; // Đà Nẵng
const HP_CODE  = 31; // Hải Phòng
const CT_CODE  = 92; // Cần Thơ

// Map mã tỉnh cũ → tên tỉnh mới (sau sáp nhập 2025)
// Các tỉnh bị sáp nhập sẽ map vào tỉnh mới
const PROVINCE_MERGE_MAP = {
  79: { code: 'HCM', name: 'TP Hồ Chí Minh' },
  77: { code: 'HCM', name: 'TP Hồ Chí Minh' }, // Bà Rịa - Vũng Tàu → HCM
  74: { code: 'HCM', name: 'TP Hồ Chí Minh' }, // Bình Dương → HCM
  1:  { code: 'HN',  name: 'Hà Nội' },
  48: { code: 'DN',  name: 'Đà Nẵng' },
  49: { code: 'DN',  name: 'Đà Nẵng' }, // Quảng Nam → Đà Nẵng
  31: { code: 'HP',  name: 'Hải Phòng' },
  30: { code: 'HP',  name: 'Hải Phòng' }, // Hải Dương → Hải Phòng
  92: { code: 'CT',  name: 'Cần Thơ' },
  94: { code: 'CT',  name: 'Cần Thơ' }, // Sóc Trăng → Cần Thơ
  95: { code: 'CT',  name: 'Cần Thơ' }, // Bạc Liêu → Cà Mau (nhưng CT nếu Hậu Giang)
  93: { code: 'CT',  name: 'Cần Thơ' }, // Hậu Giang → Cần Thơ
  46: { code: 'HUE', name: 'Huế' },
  // Các tỉnh độc lập
  89: { code: 'AG',  name: 'An Giang' },
  68: { code: 'AG',  name: 'An Giang' }, // Kiên Giang → An Giang
  75: { code: 'BP',  name: 'Bình Phước' },
  96: { code: 'CM',  name: 'Cà Mau' },
  95: { code: 'CM',  name: 'Cà Mau' }, // Bạc Liêu → Cà Mau
  4:  { code: 'CB',  name: 'Cao Bằng' },
  20: { code: 'CB',  name: 'Cao Bằng' }, // Lạng Sơn → Cao Bằng
  11: { code: 'DB',  name: 'Điện Biên' },
  12: { code: 'DB',  name: 'Điện Biên' }, // Lai Châu → Điện Biên
  14: { code: 'DB',  name: 'Điện Biên' }, // Sơn La → Điện Biên
  66: { code: 'DLK', name: 'Đắk Lắk' },
  87: { code: 'DT',  name: 'Đồng Tháp' },
  82: { code: 'DT',  name: 'Đồng Tháp' }, // Tiền Giang → Đồng Tháp
  75: { code: 'BP',  name: 'Bình Phước' },
  39: { code: 'DNA', name: 'Đồng Nai' },
  64: { code: 'GL',  name: 'Gia Lai' },
  62: { code: 'GL',  name: 'Gia Lai' }, // Kon Tum → Gia Lai
  33: { code: 'HY',  name: 'Hưng Yên' },
  34: { code: 'HY',  name: 'Hưng Yên' }, // Thái Bình → Hưng Yên
  56: { code: 'KH',  name: 'Khánh Hòa' },
  54: { code: 'KH',  name: 'Khánh Hòa' }, // Phú Yên → Khánh Hòa
  10: { code: 'LCI', name: 'Lào Cai' },
  15: { code: 'LCI', name: 'Lào Cai' }, // Yên Bái → Lào Cai
  68: { code: 'LDG', name: 'Lâm Đồng' },
  60: { code: 'LDG', name: 'Lâm Đồng' }, // Bình Thuận → Lâm Đồng
  67: { code: 'LDG', name: 'Lâm Đồng' }, // Đắk Nông → Lâm Đồng
  80: { code: 'LA',  name: 'Long An' },
  40: { code: 'NAN', name: 'Nghệ An' },
  42: { code: 'NAN', name: 'Nghệ An' }, // Hà Tĩnh → Nghệ An
  35: { code: 'NB',  name: 'Ninh Bình' },
  36: { code: 'NB',  name: 'Ninh Bình' }, // Hà Nam → Ninh Bình
  38: { code: 'NB',  name: 'Ninh Bình' }, // Nam Định → Ninh Bình
  58: { code: 'NT',  name: 'Ninh Thuận' },
  25: { code: 'PT',  name: 'Phú Thọ' },
  26: { code: 'PT',  name: 'Phú Thọ' }, // Vĩnh Phúc → Phú Thọ
  17: { code: 'PT',  name: 'Phú Thọ' }, // Hòa Bình → Phú Thọ
  44: { code: 'QB',  name: 'Quảng Bình' },
  45: { code: 'QB',  name: 'Quảng Bình' }, // Quảng Trị → Quảng Bình
  51: { code: 'QN',  name: 'Quảng Ngãi' },
  52: { code: 'QN',  name: 'Quảng Ngãi' }, // Bình Định → Quảng Ngãi
  22: { code: 'QNI', name: 'Quảng Ninh' },
  38: { code: 'TH',  name: 'Thanh Hóa' },
  27: { code: 'TN',  name: 'Thái Nguyên' },
  6:  { code: 'TN',  name: 'Thái Nguyên' }, // Bắc Kạn → Thái Nguyên
  24: { code: 'TN',  name: 'Thái Nguyên' }, // Bắc Giang → Thái Nguyên
  8:  { code: 'TQ',  name: 'Tuyên Quang' },
  2:  { code: 'TQ',  name: 'Tuyên Quang' }, // Hà Giang → Tuyên Quang
  72: { code: 'TYN', name: 'Tây Ninh' },
  86: { code: 'VL',  name: 'Vĩnh Long' },
  83: { code: 'VL',  name: 'Vĩnh Long' }, // Bến Tre → Vĩnh Long
  84: { code: 'VL',  name: 'Vĩnh Long' }, // Trà Vinh → Vĩnh Long
};

// Priority order for provinces (HCMC first, then other major cities, then alphabetical)
const PROVINCE_PRIORITY = ['HCM', 'HN', 'DN', 'HP', 'CT', 'HUE'];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log('Fetching all provinces...');
  const provinces = await fetchJSON(`${BASE}/p/`);
  console.log(`  Got ${provinces.length} provinces`);

  // Build district_code → province_code mapping
  const districtToProvince = {};
  for (const p of provinces) {
    const pFull = await fetchJSON(`${BASE}/p/${p.code}?depth=2`);
    for (const d of pFull.districts || []) {
      districtToProvince[d.code] = p.code;
    }
    process.stdout.write('.');
  }
  console.log('\n  District→Province map built');

  console.log('Fetching all wards...');
  const wards = await fetchJSON(`${BASE}/w/`);
  console.log(`  Got ${wards.length} wards`);

  // Transform wards
  const transformed = [];
  const seenCodes = new Set();

  for (const w of wards) {
    const provinceCode = districtToProvince[w.district_code];
    const provinceInfo = PROVINCE_MERGE_MAP[provinceCode] || {
      code: `P${provinceCode}`,
      name: `Tỉnh ${provinceCode}`,
    };

    // Generate unique code
    const slug = w.codename
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .slice(0, 40);
    const code = `${provinceInfo.code}_${w.code}_${slug.slice(0, 20)}`;

    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    const type =
      w.division_type === 'phường' ? 'phuong'
        : w.division_type === 'xã' ? 'xa'
          : w.division_type === 'đặc khu' ? 'dac_khu'
            : 'xa'; // thị trấn → xa after 2025 reform

    transformed.push({
      code,
      name: w.name,
      type,
      provinceCode: provinceInfo.code,
      province: provinceInfo.name,
      _sort: PROVINCE_PRIORITY.includes(provinceInfo.code)
        ? PROVINCE_PRIORITY.indexOf(provinceInfo.code)
        : 999,
      _apiCode: w.code,
    });
  }

  // Sort: HCMC first, then other priority provinces, then rest
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
  console.log('Top provinces:', Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([k,v]) => `${k}:${v}`).join(', '));

  // Generate TypeScript file
  const lines = [
    '/**',
    ' * Danh sách phường/xã toàn quốc Vietnam',
    ' * Nguồn: provinces.open-api.vn (dữ liệu chính phủ)',
    ` * Tổng: ${transformed.length} đơn vị hành chính cấp xã`,
    ' * TPHCM ưu tiên đầu, sau đó HN, DN, HP, CT, Huế, rồi các tỉnh khác.',
    ' * Lưu ý: Sau cải cách 2025, cấp quận/huyện không còn.',
    ` * Generated: ${new Date().toISOString()}`,
    ' * Run: node scripts/fetch-wards.mjs',
    ' */',
    '',
    "export interface Ward {",
    "  code: string;",
    "  name: string;",
    "  type: 'phuong' | 'xa' | 'dac_khu';",
    "  provinceCode: string;",
    "  province: string;",
    "}",
    "",
    "/** Toàn bộ phường/xã — TPHCM ưu tiên đầu */",
    "export const VIETNAM_WARDS: Ward[] = [",
  ];

  // Group by province for comments
  let lastProvince = '';
  for (const w of transformed) {
    if (w.provinceCode !== lastProvince) {
      lines.push(`  // ── ${w.province} (${w.provinceCode}) ──`);
      lastProvince = w.provinceCode;
    }
    lines.push(
      `  { code: ${JSON.stringify(w.code)}, name: ${JSON.stringify(w.name)}, type: '${w.type}', provinceCode: '${w.provinceCode}', province: ${JSON.stringify(w.province)} },`
    );
  }

  lines.push('];', '');

  // Add helper functions
  lines.push(
    '/** Chỉ phường/xã TPHCM */',
    `export const HCMC_WARDS = VIETNAM_WARDS.filter(w => w.provinceCode === 'HCM');`,
    '',
    '/** Lấy phường/xã theo tỉnh */',
    'export function getWardsByProvince(provinceCode: string): Ward[] {',
    '  return VIETNAM_WARDS.filter(w => w.provinceCode === provinceCode);',
    '}',
    '',
    '/** Tìm kiếm phường/xã (TPHCM ưu tiên) */',
    'export function searchWards(query: string, limit = 20): Ward[] {',
    '  if (!query.trim()) return HCMC_WARDS.slice(0, limit);',
    '  const q = query.toLowerCase().trim();',
    '  return VIETNAM_WARDS',
    "    .filter(w => w.name.toLowerCase().includes(q))",
    '    .slice(0, limit);',
    '}',
    '',
    '/** Tên phường/xã để dùng trong autocomplete (TPHCM đầu) */',
    'export const WARD_NAMES_HCM_FIRST: string[] = VIETNAM_WARDS.map(w => w.name);',
  );

  writeFileSync(OUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`\nWrote ${transformed.length} wards to: ${OUT_FILE}`);
  console.log(`File size: ${(lines.join('\n').length / 1024).toFixed(0)} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
