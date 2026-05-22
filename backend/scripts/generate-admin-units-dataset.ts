/**
 * Generate admin units dataset (one-shot script).
 *
 * Source: frontend/src/data/wards-full.json (10,051 wards, 32 provinces)
 * Output: backend/data/admin-units/v2024-1279.json + .sha256
 *
 * Provenance: NQ 1279/QH15 ngày 12/06/2024 (cải cách hành chính cấp xã).
 * Run: cd backend && npx ts-node scripts/generate-admin-units-dataset.ts
 *
 * v0.34a: ship 1 lần, sau này bump version qua PR review.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Mã chính danh tỉnh/TP (Bộ Nội vụ NQ 1279 + chuẩn QCVN GSO).
// 32 entries — match keys trong wards-full.json (sau cải cách 2025).
const PROVINCE_OFFICIAL_CODES: Record<string, string> = {
  HCM: '79',  // TP. Hồ Chí Minh
  HN: '01',   // TP. Hà Nội
  DN: '48',   // TP. Đà Nẵng
  HP: '31',   // TP. Hải Phòng
  CT: '92',   // TP. Cần Thơ
  HUE: '46',  // TP. Huế
  AG: '89',   // An Giang
  BP: '70',   // Bình Phước (mới: gộp Bình Dương)
  CM: '96',   // Cà Mau
  CB: '04',   // Cao Bằng
  DB: '11',   // Điện Biên
  DLK: '66',  // Đắk Lắk
  DT: '87',   // Đồng Tháp
  DNA: '74',  // Đồng Nai (mới: gộp Bà Rịa-Vũng Tàu)
  GL: '64',   // Gia Lai (mới: gộp Bình Định)
  HY: '33',   // Hưng Yên (mới: gộp Thái Bình)
  KH: '56',   // Khánh Hòa (mới: gộp Ninh Thuận)
  LCI: '24',  // Lào Cai (mới: gộp Yên Bái)
  LDG: '68',  // Lâm Đồng (mới: gộp Bình Thuận + Đắk Nông)
  LA: '80',   // Tây Ninh (mới: gộp Long An — code LA giữ legacy)
  NAN: '40',  // Nghệ An
  NB: '37',   // Ninh Bình (mới: gộp Hà Nam + Nam Định)
  NT: '52',   // Quảng Ngãi (mới: gộp Kon Tum)
  PT: '25',   // Phú Thọ (mới: gộp Vĩnh Phúc + Hòa Bình)
  QB: '49',   // Quảng Trị (mới: gộp Quảng Bình)
  QN: '20',   // Quảng Ninh
  QNI: '49',  // (alias QB)
  TH: '38',   // Thanh Hóa
  TN: '94',   // Tây Ninh (alias LA)
  TQ: '08',   // Tuyên Quang (mới: gộp Hà Giang)
  TYN: '94',  // (alias TN)
  VL: '86',   // Vĩnh Long (mới: gộp Trà Vinh + Bến Tre)
};

interface RawWard {
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  province: string;
}

interface OutputProvince {
  code: string;
  name: string;
  officialCode: string | null;
}

interface OutputWard {
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  officialCode: string | null;
}

interface OutputDataset {
  version: string;
  legalBasis: string;
  effectiveFrom: string; // ISO date
  downloadedAt: string;  // ISO datetime
  sourceUrl: string;
  sourceNote: string;
  provinces: OutputProvince[];
  wards: OutputWard[];
}

// Extract ward officialCode từ code pattern `{PROV}_{NUM}_PHUONG_{SLUG}` → NUM
function extractWardOfficialCode(code: string): string | null {
  const m = code.match(/_(\d+)_/);
  return m ? m[1] : null;
}

function main() {
  const inputPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'wards-full.json');
  const outputDir = path.join(__dirname, '..', 'data', 'admin-units');
  const version = 'v2024-1279';
  const outputJson = path.join(outputDir, `${version}.json`);
  const outputSha = path.join(outputDir, `${version}.sha256`);

  console.log(`Reading ${inputPath}...`);
  const raw: RawWard[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`  Total wards: ${raw.length}`);

  // Build provinces dedupe by code
  const provincesMap = new Map<string, OutputProvince>();
  for (const w of raw) {
    if (!provincesMap.has(w.provinceCode)) {
      provincesMap.set(w.provinceCode, {
        code: w.provinceCode,
        name: w.province,
        officialCode: PROVINCE_OFFICIAL_CODES[w.provinceCode] ?? null,
      });
    }
  }
  const provinces = Array.from(provincesMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  console.log(`  Total provinces: ${provinces.length}`);

  const missingOfficial = provinces.filter(p => !p.officialCode);
  if (missingOfficial.length > 0) {
    console.warn(`  Warning: ${missingOfficial.length} provinces thiếu officialCode:`, missingOfficial.map(p => p.code));
  }

  const wards: OutputWard[] = raw.map(w => ({
    code: w.code,
    name: w.name,
    type: w.type,
    provinceCode: w.provinceCode,
    officialCode: extractWardOfficialCode(w.code),
  }));

  const output: OutputDataset = {
    version,
    legalBasis: 'Nghị quyết 1279/NQ-UBTVQH15 ngày 12/06/2024 + NQ 60/2025 sắp xếp đơn vị hành chính cấp xã',
    effectiveFrom: '2025-07-01',
    downloadedAt: new Date().toISOString(),
    sourceUrl: 'https://provinces.open-api.vn/api (cross-check dvhcvn.gov.vn)',
    sourceNote: 'Snapshot dữ liệu cấp xã sau cải cách hành chính 2025. 34 tỉnh/TP, ~10k phường/xã. ' +
      'PC02 dùng làm reference geography — KHÔNG live API call từ production. ' +
      'Update: dev pull dvhcvn → bump version → PR review → merge → deploy auto-import.',
    provinces,
    wards,
  };

  // Stable JSON formatting cho checksum deterministic
  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(outputJson, json, 'utf8');
  console.log(`Written ${outputJson} (${(json.length / 1024).toFixed(1)} KB)`);

  const sha = createHash('sha256').update(json).digest('hex');
  fs.writeFileSync(outputSha, sha + '\n', 'utf8');
  console.log(`Written ${outputSha}`);
  console.log(`  SHA256: ${sha}`);
}

main();
