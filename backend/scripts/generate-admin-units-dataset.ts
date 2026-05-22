/**
 * Generate admin units dataset từ provinces.open-api.vn v2 (CHÍNH DANH sau cải cách 2025).
 *
 * v0.34.0.1: switch source từ wards-full.json (legacy, có 241 phường tên số kiểu cũ)
 * sang API v2 (sau NQ 60/2025 hiệu lực 01/07/2025) — tên địa danh chính xác.
 *
 * Output: backend/data/admin-units/v2025-1300.json + .sha256
 * Run: cd backend && npx ts-node scripts/generate-admin-units-dataset.ts
 *
 * Source: https://provinces.open-api.vn/api/v2 — cross-check dvhcvn.gov.vn khi update.
 * Snapshot import (seedAdminUnits) sẽ detect version mới → re-import + abolish legacy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const OUTPUT_VERSION = 'v2025-1300'; // post NQ 60/2025
const API_BASE = 'https://provinces.open-api.vn/api/v2';

// Mã hệ thống PC02 ↔ officialCode Bộ Nội vụ (Vietnam Reform 2025: 34 tỉnh/TP,
// hiệu lực 01/07/2025 theo NQ 60/NQ-CP + NQ 1279/QH15). Source verified với
// API v2 provinces.open-api.vn ngày 22/05/2026.
const PROVINCE_CODE_BY_OFFICIAL: Record<string, string> = {
  '01': 'HN',   // Hà Nội
  '04': 'CB',   // Cao Bằng
  '08': 'TQ',   // Tuyên Quang (gộp Hà Giang)
  '11': 'DB',   // Điện Biên
  '12': 'LC',   // Lai Châu
  '14': 'SL',   // Sơn La
  '15': 'LCI',  // Lào Cai (gộp Yên Bái)
  '19': 'TNG',  // Thái Nguyên — TNG để tránh collision với TN=Tây Ninh
  '20': 'LS',   // Lạng Sơn
  '22': 'QN',   // Quảng Ninh
  '24': 'BN',   // Bắc Ninh (gộp Bắc Giang)
  '25': 'PT',   // Phú Thọ (gộp Vĩnh Phúc + Hòa Bình)
  '31': 'HP',   // Hải Phòng
  '33': 'HY',   // Hưng Yên (gộp Thái Bình)
  '37': 'NB',   // Ninh Bình (gộp Hà Nam + Nam Định)
  '38': 'TH',   // Thanh Hóa
  '40': 'NAN',  // Nghệ An
  '42': 'HT',   // Hà Tĩnh
  '44': 'QT',   // Quảng Trị (gộp Quảng Bình)
  '46': 'HUE',  // Huế
  '48': 'DN',   // Đà Nẵng
  '51': 'QNG',  // Quảng Ngãi (gộp Kon Tum)
  '52': 'GL',   // Gia Lai (gộp Bình Định)
  '56': 'KH',   // Khánh Hòa (gộp Ninh Thuận)
  '66': 'DLK',  // Đắk Lắk
  '68': 'LDG',  // Lâm Đồng (gộp Bình Thuận + Đắk Nông)
  '75': 'DNA',  // Đồng Nai (gộp Bà Rịa-Vũng Tàu)
  '79': 'HCM',  // TP. Hồ Chí Minh (gộp Bình Dương + Bà Rịa-Vũng Tàu một phần)
  '80': 'TN',   // Tây Ninh (gộp Long An)
  '82': 'DT',   // Đồng Tháp (gộp Tiền Giang)
  '86': 'VL',   // Vĩnh Long (gộp Trà Vinh + Bến Tre)
  '91': 'AG',   // An Giang (gộp Kiên Giang)
  '92': 'CT',   // Cần Thơ (gộp Hậu Giang + Sóc Trăng)
  '96': 'CM',   // Cà Mau (gộp Bạc Liêu)
};

interface ApiWard {
  code: number;
  name: string;
  division_type: string;
}

interface ApiProvince {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  wards?: ApiWard[];
}

interface OutputProvince {
  code: string;
  name: string;
  officialCode: string;
  divisionType: string;
}

interface OutputWard {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
  officialCode: string;
}

interface OutputDataset {
  version: string;
  legalBasis: string;
  effectiveFrom: string;
  downloadedAt: string;
  sourceUrl: string;
  sourceNote: string;
  provinces: OutputProvince[];
  wards: OutputWard[];
}

function pad(n: number, width = 2): string {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function main() {
  console.log('Fetching province list from API v2...');
  const provinces = await fetchJson<ApiProvince[]>(`${API_BASE}/p/`);
  console.log(`  Got ${provinces.length} provinces`);

  if (provinces.length !== 34) {
    throw new Error(`Expected 34 provinces after 2025 reform, got ${provinces.length}`);
  }

  const outputProvinces: OutputProvince[] = [];
  const outputWards: OutputWard[] = [];
  let unmapped = 0;

  for (const p of provinces) {
    const officialCode = pad(p.code);
    const pc02Code = PROVINCE_CODE_BY_OFFICIAL[officialCode];
    if (!pc02Code) {
      console.warn(`  [WARN] No PC02 code for province officialCode=${officialCode} ${p.name}`);
      unmapped++;
      continue;
    }

    outputProvinces.push({
      code: pc02Code,
      name: p.name,
      officialCode,
      divisionType: p.division_type,
    });

    // Fetch wards detail
    process.stdout.write(`  ${pc02Code} ${p.name}... `);
    const pDetail = await fetchJson<ApiProvince>(`${API_BASE}/p/${p.code}?depth=2`);
    const wards = pDetail.wards ?? [];
    for (const w of wards) {
      const wOfficial = String(w.code);
      // Ward code format: PROV_OFFICIAL_TYPE_SLUG (preserve pattern cho stability)
      const slug = w.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const typeCode = w.division_type.toLowerCase().includes('xã')
        ? 'XA'
        : w.division_type.toLowerCase().includes('đặc khu')
          ? 'DAC_KHU'
          : 'PHUONG';
      outputWards.push({
        code: `${pc02Code}_${wOfficial}_${typeCode}_${slug}`.slice(0, 100),
        name: w.name,
        type: typeCode.toLowerCase() === 'dac_khu' ? 'dac_khu' : typeCode === 'XA' ? 'xa' : 'phuong',
        provinceCode: pc02Code,
        officialCode: wOfficial,
      });
    }
    console.log(`${wards.length} wards`);
  }

  console.log(`\nTotal: ${outputProvinces.length} provinces, ${outputWards.length} wards (${unmapped} unmapped)`);

  // Sanity check — verify NO numeric-named wards (post-reform should be all named)
  const numericNamed = outputWards.filter((w) => /^(Phường|Xã)\s+\d+[A-Z]?$/.test(w.name));
  if (numericNamed.length > 0) {
    console.warn(`  [WARN] ${numericNamed.length} wards still có tên số (kỳ vọng 0 sau cải cách 2025):`);
    numericNamed.slice(0, 5).forEach((w) => console.warn(`    ${w.provinceCode} - ${w.name}`));
  } else {
    console.log('  ✓ Không có ward tên số kiểu cũ — chính xác sau cải cách 2025.');
  }

  const output: OutputDataset = {
    version: OUTPUT_VERSION,
    legalBasis: 'Nghị quyết 60/NQ-CP ngày 25/04/2025 sắp xếp đơn vị hành chính cấp xã + NQ 1279/QH15',
    effectiveFrom: '2025-07-01',
    downloadedAt: new Date().toISOString(),
    sourceUrl: `${API_BASE} (provinces.open-api.vn v2 — đã refresh post NQ 60/2025)`,
    sourceNote:
      'Snapshot dữ liệu cấp xã sau cải cách hành chính 2025. 34 tỉnh/TP, ~3000-3500 phường/xã. ' +
      'PC02 dùng làm reference geography — KHÔNG live API call từ production. ' +
      'Update: dev pull dvhcvn → bump version → PR review → merge → deploy auto-import.',
    provinces: outputProvinces.sort((a, b) => a.code.localeCompare(b.code)),
    wards: outputWards.sort((a, b) =>
      a.provinceCode.localeCompare(b.provinceCode) || a.name.localeCompare(b.name),
    ),
  };

  const outputDir = path.join(__dirname, '..', 'data', 'admin-units');
  const outputJson = path.join(outputDir, `${OUTPUT_VERSION}.json`);
  const outputSha = path.join(outputDir, `${OUTPUT_VERSION}.sha256`);

  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(outputJson, json, 'utf8');
  console.log(`\nWritten ${outputJson} (${(json.length / 1024).toFixed(1)} KB)`);

  const sha = createHash('sha256').update(json).digest('hex');
  fs.writeFileSync(outputSha, sha + '\n', 'utf8');
  console.log(`Written ${outputSha}`);
  console.log(`  SHA256: ${sha}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
