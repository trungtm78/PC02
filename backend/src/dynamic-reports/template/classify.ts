import { parseToken } from '../engine/token';
import type { ParsedToken } from '../engine/token';

/**
 * Cell classification (spec §3 "Quy tắc ô", §10 R3). Turns the raw signals
 * a parser pass over one cell produces into a classification + issues[].
 * This is the single place the "unlocked+literal → warn, don't block"
 * decision lives — it deliberately overrides the original FRD FR-002,
 * which would have treated a sample number left in an unlocked cell as a
 * blocking error; spec §3 chose warn-and-suggest instead, because every
 * real legacy template has sample numbers in its unlocked cells and none
 * of them ever turn on Excel's own sheet protection.
 */
export type CellClassification =
  | 'STATIC_TEXT'
  | 'STATIC_FORMULA'
  | 'INPUT_FIELD';

export type CellIssueCode =
  | 'UNLOCKED_NO_TOKEN'
  | 'LOCKED_LOOKS_LIKE_TOKEN'
  | 'HIDDEN_INPUT_CELL';

export interface CellIssue {
  code: CellIssueCode;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ClassifyCellInput {
  /** Effective locked state (locked.ts), already resolved cell→row→column→default. */
  locked: boolean;
  hasFormula: boolean;
  /** Raw literal cell value — ignored when hasFormula is true. */
  rawValue: unknown;
  /** True for every merged cell except the top-left anchor. */
  isMergeNonAnchor: boolean;
  /** True if the cell's row or column is hidden. */
  isHidden: boolean;
}

export interface ClassifyCellResult {
  classification: CellClassification;
  field?: ParsedToken;
  issues: CellIssue[];
}

const LOOKS_LIKE_TOKEN_RE = /^\s*\{.*\}\s*$/;

function looksLikeToken(rawValue: unknown): boolean {
  return typeof rawValue === 'string' && LOOKS_LIKE_TOKEN_RE.test(rawValue);
}

export function classifyCell(input: ClassifyCellInput): ClassifyCellResult {
  if (input.isMergeNonAnchor) {
    return { classification: 'STATIC_TEXT', issues: [] };
  }

  if (input.hasFormula) {
    return { classification: 'STATIC_FORMULA', issues: [] };
  }

  if (!input.locked) {
    const parsed =
      typeof input.rawValue === 'string'
        ? parseToken(input.rawValue)
        : { ok: false as const };
    if (parsed.ok) {
      const issues: CellIssue[] = [];
      if (input.isHidden) {
        issues.push({
          code: 'HIDDEN_INPUT_CELL',
          severity: 'ERROR',
          message:
            'Ô nhập nằm trên dòng/cột đang ẩn — phải hiện dòng/cột này hoặc bỏ token.',
        });
      }
      return { classification: 'INPUT_FIELD', field: parsed.token, issues };
    }
    return {
      classification: 'STATIC_TEXT',
      issues: [
        {
          code: 'UNLOCKED_NO_TOKEN',
          severity: 'WARNING',
          message:
            'Ô đang mở khoá nhưng không có token hợp lệ — gợi ý đặt làm ô nhập hoặc khoá lại ô này.',
        },
      ],
    };
  }

  if (looksLikeToken(input.rawValue)) {
    return {
      classification: 'STATIC_TEXT',
      issues: [
        {
          code: 'LOCKED_LOOKS_LIKE_TOKEN',
          severity: 'WARNING',
          message:
            'Nội dung ô giống token nhưng ô đang khoá — mở khoá nếu muốn dùng làm ô nhập.',
        },
      ],
    };
  }

  return { classification: 'STATIC_TEXT', issues: [] };
}
