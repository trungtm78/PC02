/**
 * gen-legacy-parity-fields.ts — sinh `frontend/src/shared/legacy/legacyParityFields.generated.ts`
 * từ `field-parity.def.ts`.
 *
 * Vì sao có tệp này: tệp phía giao diện mang dòng đầu "AUTO-GENERATED — KHÔNG sửa tay" nhưng
 * công cụ sinh ra nó không còn trong kho mã. Hệ quả là thêm cột vào `field-parity.def.ts`
 * thì tệp kia đứng yên, và panel "Thông tin nghiệp vụ bổ sung" âm thầm thiếu ô — một kiểu
 * hỏng không ai thấy cho tới khi cán bộ báo mất dữ liệu.
 *
 * Dùng: ./node_modules/.bin/ts-node src/legacy-migration/cli/gen-legacy-parity-fields.ts
 *       thêm --check để chỉ KIỂM tệp có khớp không (dùng cho cổng CI), không ghi đè.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PARITY, type Entity, type ParityCol } from '../field-parity.def';

const DICH = path.resolve(__dirname, '../../../../frontend/src/shared/legacy/legacyParityFields.generated.ts');

type ParityKind = 'text' | 'date' | 'number' | 'checkbox';

function kind(c: ParityCol): ParityKind {
  switch (c.type) {
    case 'DateTime':
      return 'date';
    case 'Int':
    case 'Float':
      return 'number';
    case 'Boolean':
      return 'checkbox';
    default:
      return 'text';
  }
}

export function renderParityFieldsFile(parity: Record<Entity, ParityCol[]>): string {
  const out: Record<string, { col: string; kind: ParityKind; label: string }[]> = {};
  for (const e of ['petition', 'incident', 'case'] as Entity[]) {
    // CHỈ cột MỚI: cột `exists` đã có ô ở form chính từ trước, dựng thêm ô nữa là hai chỗ
    // cùng ghi một cột.
    out[e] = parity[e]
      .filter((c) => !c.exists)
      .map((c) => ({ col: c.col, kind: kind(c), label: c.field }));
  }
  return (
    '// AUTO-GENERATED từ backend field-parity.def.ts — KHÔNG sửa tay.\n' +
    '// Sinh lại: ./node_modules/.bin/ts-node src/legacy-migration/cli/gen-legacy-parity-fields.ts\n' +
    '// CHỈ gồm CỘT MỚI (exists!=true); cột đã có ô form chính bị loại để tránh double-edit.\n' +
    'export type ParityKind = "text"|"date"|"number"|"checkbox";\n' +
    'export interface ParityFieldDef { col: string; kind: ParityKind; label: string; }\n' +
    'export const LEGACY_PARITY_FIELDS: Record<"petition"|"incident"|"case", ParityFieldDef[]> = ' +
    JSON.stringify(out, null, 2) +
    ';\n'
  );
}

function main(): void {
  const noiDung = renderParityFieldsFile(PARITY);
  const chiKiem = process.argv.includes('--check');
  const hienCo = fs.existsSync(DICH) ? fs.readFileSync(DICH, 'utf8') : '';

  if (chiKiem) {
    if (hienCo.replace(/\r\n/g, '\n') !== noiDung) {
      console.error(
        'legacyParityFields.generated.ts KHÔNG khớp field-parity.def.ts.\n' +
          'Chạy: ./node_modules/.bin/ts-node src/legacy-migration/cli/gen-legacy-parity-fields.ts',
      );
      process.exit(1);
    }
    console.log('legacyParityFields.generated.ts khớp đặc tả.');
    return;
  }

  fs.writeFileSync(DICH, noiDung, 'utf8');
  console.log(`Đã sinh ${DICH}`);
}

if (require.main === module) main();
