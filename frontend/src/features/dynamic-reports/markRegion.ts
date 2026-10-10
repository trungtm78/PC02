import { TYPE_AGGREGATE_COMPATIBILITY } from './engine/generated/token';
import type {
  MarkableCell,
  ParsedField,
  ParsedFieldType,
  ParsedAggregateType,
  ParsedIssue,
  TemplatePreviewResult,
} from './types';

/**
 * S04 web-marking (spec §10 "chọn trên web"). Pure, client-side: the whole
 * preview result already lives in the wizard's React state after
 * `/templates/preview`, so applying/undoing a batch of marks is just a
 * data transform — no server round trip needed until publish (slice 5),
 * where the server re-validates authoritatively against the raw bytes.
 *
 * Mirrors backend `parser.ts`'s own `UNLOCKED_NO_TOKEN` warning text
 * exactly (classify.ts) so a cell that gets unmarked goes back to looking
 * identical to one the server itself would have reported.
 */
export interface WebMarkRequest {
  sheetKey: string;
  address: string;
  label: string;
  type: ParsedFieldType;
  format: string;
  aggregate: ParsedAggregateType;
}

export type ApplyWebMarksResult =
  | { ok: true; result: TemplatePreviewResult }
  | { ok: false; errors: string[] };

const UNLOCKED_NO_TOKEN_MESSAGE =
  'Ô đang mở khoá nhưng không có token hợp lệ — gợi ý đặt làm ô nhập hoặc khoá lại ô này.';

function cellKey(sheetKey: string, address: string): string {
  return `${sheetKey}!${address}`;
}

/**
 * Validates the whole batch before changing anything (atomic — same
 * "nguyên tử" policy as `engine/paste.ts`: one bad cell in a region rejects
 * the entire region, never a partial apply).
 */
export function applyWebMarks(
  result: TemplatePreviewResult,
  marks: WebMarkRequest[],
): ApplyWebMarksResult {
  if (marks.length === 0) {
    return { ok: false, errors: ['Chưa chọn ô nào để đánh dấu.'] };
  }

  const markable = new Map(
    result.markableCells.map((c) => [cellKey(c.sheetKey, c.address), c]),
  );
  const existingKeys = new Set(result.fields.map((f) => f.fieldKey));
  const seenInBatch = new Set<string>();
  const errors: string[] = [];

  for (const mark of marks) {
    const key = cellKey(mark.sheetKey, mark.address);
    if (!markable.has(key)) {
      errors.push(`${key}: ô này không ở trạng thái có thể đánh dấu.`);
      continue;
    }
    if (existingKeys.has(key) || seenInBatch.has(key)) {
      errors.push(`${key}: ô này đã là một field.`);
      continue;
    }
    if (!mark.label.trim()) {
      errors.push(`${key}: phải có nhãn.`);
      continue;
    }
    if (!TYPE_AGGREGATE_COMPATIBILITY[mark.type].includes(mark.aggregate)) {
      errors.push(`${key}: kiểu ${mark.type} không hỗ trợ tổng hợp ${mark.aggregate}.`);
      continue;
    }
    seenInBatch.add(key);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const markedKeys = new Set(marks.map((m) => cellKey(m.sheetKey, m.address)));
  const newFields: ParsedField[] = marks.map((m) => ({
    sheetKey: m.sheetKey,
    address: m.address,
    fieldKey: cellKey(m.sheetKey, m.address),
    label: m.label.trim(),
    type: m.type,
    format: m.format,
    aggregate: m.aggregate,
    source: 'WEB',
  }));

  return {
    ok: true,
    result: {
      ...result,
      fields: [...result.fields, ...newFields],
      markableCells: result.markableCells.filter(
        (c) => !markedKeys.has(cellKey(c.sheetKey, c.address)),
      ),
      issues: result.issues.filter(
        (i) =>
          !(i.code === 'UNLOCKED_NO_TOKEN' && markedKeys.has(cellKey(i.sheetKey, i.address))),
      ),
      inputCellCount: result.inputCellCount + newFields.length,
    },
  };
}

/** Reverses applyWebMarks for the given WEB-sourced fields; TOKEN fields are left untouched. */
export function removeWebMarks(
  result: TemplatePreviewResult,
  fieldKeys: string[],
): TemplatePreviewResult {
  const toRemove = new Set(fieldKeys);
  const removed: ParsedField[] = [];
  const keptFields: ParsedField[] = [];
  for (const f of result.fields) {
    if (f.source === 'WEB' && toRemove.has(f.fieldKey)) {
      removed.push(f);
    } else {
      keptFields.push(f);
    }
  }
  if (removed.length === 0) return result;

  const restoredMarkable: MarkableCell[] = removed.map((f) => ({
    sheetKey: f.sheetKey,
    address: f.address,
    suggestedLabel: f.label || null,
  }));
  const restoredIssues: ParsedIssue[] = removed.map((f) => ({
    sheetKey: f.sheetKey,
    address: f.address,
    code: 'UNLOCKED_NO_TOKEN',
    severity: 'WARNING',
    message: UNLOCKED_NO_TOKEN_MESSAGE,
  }));

  return {
    ...result,
    fields: keptFields,
    markableCells: [...result.markableCells, ...restoredMarkable],
    issues: [...result.issues, ...restoredIssues],
    inputCellCount: result.inputCellCount - removed.length,
  };
}
