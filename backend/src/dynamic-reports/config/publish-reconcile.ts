import type { ParseTemplateResult } from '../template/types';

/**
 * Publish-time reconciliation (review OV3). The wizard sends the list of
 * input cells it believes the template has; at the moment of publishing, the
 * server re-reads the uploaded file and refuses anything that disagrees with
 * it. Without this a hand-built or stale request can make a locked cell, a
 * formula cell or a hidden cell editable, or silently drop an input the
 * template declares — and an officer would then type into a cell the
 * original form protects.
 *
 * Pure: takes the already-parsed workbook and the submitted fields.
 */

export interface SubmittedField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: string;
  aggregate: string;
  source: 'TOKEN' | 'WEB';
}

const ADDRESS_RE = /^[A-Z]{1,3}[0-9]{1,7}$/;
const MAX_REPORTED = 8;

export interface ReconcileOutcome {
  problems: string[];
}

export function reconcileFieldsWithWorkbook(
  parsed: ParseTemplateResult,
  selectedSheets: readonly string[],
  fields: readonly SubmittedField[],
): ReconcileOutcome {
  const problems: string[] = [];
  const note = (message: string) => {
    problems.push(message);
  };

  const selected = new Set(selectedSheets);
  const key = (sheet: string, address: string) => `${sheet}!${address}`;

  const tokenFields = new Map(parsed.fields.map((f) => [key(f.sheetKey, f.address), f]));
  const markable = new Set(parsed.markableCells.map((c) => key(c.sheetKey, c.address)));
  const formulaCells = new Set(parsed.formulas.map((f) => key(f.sheetKey, f.address)));

  const seen = new Set<string>();
  for (const f of fields) {
    const where = key(f.sheetKey, f.address);

    if (!selected.has(f.sheetKey)) {
      note(`${where}: sheet không nằm trong danh sách sheet của báo cáo.`);
      continue;
    }
    if (!ADDRESS_RE.test(f.address)) {
      note(`${where}: địa chỉ ô không hợp lệ (cần viết hoa, ví dụ C6).`);
      continue;
    }
    if (f.fieldKey !== where) {
      note(`${where}: mã ô phải là "${where}", nhận "${f.fieldKey}".`);
    }
    if (seen.has(where)) {
      note(`${where}: khai báo trùng.`);
      continue;
    }
    seen.add(where);

    if (formulaCells.has(where)) {
      note(`${where}: là ô công thức trong file mẫu, không thể là ô nhập.`);
      continue;
    }

    if (f.source === 'TOKEN') {
      const token = tokenFields.get(where);
      if (!token) {
        note(`${where}: khai báo theo token nhưng file mẫu không có token ở ô này.`);
      } else if (token.type !== f.type || token.aggregate !== f.aggregate) {
        note(
          `${where}: kiểu/tổng hợp (${f.type}/${f.aggregate}) khác token trong file (${token.type}/${token.aggregate}).`,
        );
      }
    } else if (!markable.has(where)) {
      note(
        `${where}: không thể đặt làm ô nhập — ô bị khoá, đã gộp, bị ẩn, đã có token hoặc không có trong file.`,
      );
    }
  }

  // Every input the template itself declares must be present: dropping one
  // would publish a form that quietly asks for less than the original.
  for (const token of parsed.fields) {
    const where = key(token.sheetKey, token.address);
    if (selected.has(token.sheetKey) && !seen.has(where)) {
      note(`${where}: file mẫu khai báo ô nhập (token) nhưng danh sách gửi lên thiếu ô này.`);
    }
  }

  return { problems: problems.slice(0, MAX_REPORTED).concat(
    problems.length > MAX_REPORTED ? [`… và ${problems.length - MAX_REPORTED} vấn đề khác.`] : [],
  ) };
}
