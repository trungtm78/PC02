/**
 * Split vietnam-wards.ts thành 2 tầng:
 * 1. vietnam-wards.ts     — HCMC + 5 TP lớn (~100KB, load ngay)
 * 2. wards-full.json      — toàn bộ 10,051 (~800KB, lazy load)
 *
 * Run: node scripts/split-wards.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FULL_TS   = join(__dirname, '../frontend/src/data/vietnam-wards.ts');
const FULL_JSON = join(__dirname, '../frontend/src/data/wards-full.json');
const OUT_TS    = FULL_TS;

// Read generated file and extract data
const content = readFileSync(FULL_TS, 'utf-8');

// Extract the array using regex
const match = content.match(/export const VIETNAM_WARDS: Ward\[\] = \[([\s\S]*?)\];/);
if (!match) throw new Error('Could not find VIETNAM_WARDS array');

// Parse entries
const entries = [];
const lineRegex = /\{ code: "([^"]+)", name: "([^"]+)", type: '([^']+)', provinceCode: '([^']+)', province: "([^"]+)" \}/g;
let m;
while ((m = lineRegex.exec(match[1])) !== null) {
  entries.push({
    code: m[1], name: m[2], type: m[3], provinceCode: m[4], province: m[5]
  });
}

console.log(`Total entries: ${entries.length}`);

// Priority provinces for Tier 1
const TIER1_PROVINCES = new Set(['HCM', 'HN', 'DN', 'HP', 'CT', 'HUE']);
const tier1 = entries.filter(w => TIER1_PROVINCES.has(w.provinceCode));
const tier2 = entries; // full list for JSON

console.log(`Tier 1 (major cities): ${tier1.length} wards`);
console.log(`Tier 2 (full): ${tier2.length} wards`);

// Write full JSON for lazy loading / seed script
writeFileSync(FULL_JSON, JSON.stringify(tier2, null, 0), 'utf-8');
console.log(`Wrote full JSON: ${(readFileSync(FULL_JSON).length / 1024).toFixed(0)} KB`);

// Generate compact tier-1 TypeScript file
const header = `/**
 * Danh sách phường/xã toàn quốc Vietnam — Tier 1 (TPHCM + 5 TP lớn)
 * Nguồn: provinces.open-api.vn
 * Tier 1: ${tier1.length} đơn vị (TPHCM + HN + ĐN + HP + CT + Huế) — load ngay
 * Tier 2: Full data tại wards-full.json (${tier2.length} đơn vị) — lazy load
 * Generated: ${new Date().toISOString()}
 */

export interface Ward {
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  province: string;
}

`;

const arr_lines = ['export const VIETNAM_WARDS: Ward[] = ['];
let lastProv = '';
for (const w of tier1) {
  if (w.provinceCode !== lastProv) {
    arr_lines.push(`  // ── ${w.province} (${w.provinceCode}) ──`);
    lastProv = w.provinceCode;
  }
  arr_lines.push(`  { code: ${JSON.stringify(w.code)}, name: ${JSON.stringify(w.name)}, type: '${w.type}', provinceCode: '${w.provinceCode}', province: ${JSON.stringify(w.province)} },`);
}
arr_lines.push('];', '');

const helpers = `/** Chỉ phường/xã TPHCM */
export const HCMC_WARDS = VIETNAM_WARDS.filter(w => w.provinceCode === 'HCM');

/** Lấy phường/xã theo tỉnh (Tier 1 only) */
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
 * Load toàn bộ 10,051 phường/xã từ wards-full.json (lazy load)
 * Dùng khi cần search toàn quốc.
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
  // HCMC first
  const hcm = all.filter(w => w.provinceCode === 'HCM' && w.name.toLowerCase().includes(q));
  const other = all.filter(w => w.provinceCode !== 'HCM' && w.name.toLowerCase().includes(q));
  return [...hcm, ...other].slice(0, limit);
}
`;

writeFileSync(OUT_TS, header + arr_lines.join('\n') + '\n' + helpers, 'utf-8');
console.log(`Wrote Tier 1 TS: ${(readFileSync(OUT_TS).length / 1024).toFixed(0)} KB`);
