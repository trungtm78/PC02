/**
 * Token engine — parses the `{TYPE|FORMAT|AGG}` grammar FRD §4.4 defines
 * for unlocked input cells. Pure, no I/O (spec §10 R2): shared verbatim
 * with the frontend so the setup wizard's live preview and the server's
 * publish-time validation can never disagree on what a token means.
 *
 * Grammar v1: `{TYPE}`, `{TYPE|FORMAT}`, `{TYPE|FORMAT|AGG}`. The token must
 * occupy the entire cell value (trimmed of surrounding whitespace only);
 * `|` and `{`/`}` cannot appear inside FORMAT in v1 — a 4th part or an
 * embedded separator is reported the same way (TOO_MANY_PARTS), never
 * silently truncated.
 */

export type FieldType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';
export type AggregateType = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'NONE';

const VALID_TYPES: readonly FieldType[] = ['NUM', 'TEXT', 'DATE', 'TIME'];
const VALID_AGGREGATES: readonly AggregateType[] = [
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COUNT',
  'NONE',
];

/**
 * Which aggregates make sense for which type (FRD §4.5: "NUM hỗ trợ SUM,
 * AVG, MIN, MAX, COUNT; mọi kiểu hỗ trợ NONE; TEXT/DATE/TIME chưa cho tổng
 * hợp ngoài NONE"). Exposed so the setup UI can grey out invalid AGG
 * choices instead of letting the user pick one the server will reject.
 */
export const TYPE_AGGREGATE_COMPATIBILITY: Record<
  FieldType,
  readonly AggregateType[]
> = {
  NUM: ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'NONE'],
  TEXT: ['NONE'],
  DATE: ['NONE'],
  TIME: ['NONE'],
};

export interface TokenWarning {
  code: 'AGV_ALIAS_NORMALIZED';
  message: string;
}

export interface ParsedToken {
  type: FieldType;
  /** Raw format content, verbatim — never reinterpreted here. */
  format: string;
  aggregate: AggregateType;
  warnings: TokenWarning[];
}

export type TokenParseErrorCode =
  | 'NOT_A_TOKEN'
  | 'UNKNOWN_TYPE'
  | 'UNKNOWN_AGGREGATE'
  | 'AGGREGATE_TYPE_MISMATCH'
  | 'TOO_MANY_PARTS'
  | 'TOKEN_NOT_WHOLE_CELL';

export interface TokenParseError {
  code: TokenParseErrorCode;
  message: string;
}

export type TokenParseResult =
  | { ok: true; token: ParsedToken }
  | { ok: false; error: TokenParseError };

function err(code: TokenParseErrorCode, message: string): TokenParseResult {
  return { ok: false, error: { code, message } };
}

/** `{...}` spanning the whole trimmed cell value, nothing before or after. */
const TOKEN_SHAPE_RE = /^\{([^{}]*)\}$/;

export function parseToken(cellValue: string): TokenParseResult {
  const trimmed = cellValue.trim();

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    if (trimmed.includes('{') || trimmed.includes('}')) {
      // Has brace-like content but isn't a clean `{...}` wrapper — most
      // likely stray text around what was meant to be a token.
      return err(
        'TOKEN_NOT_WHOLE_CELL',
        `Ô "${cellValue}" chứa ký tự ngoài token.`,
      );
    }
    return err('NOT_A_TOKEN', `Giá trị "${cellValue}" không phải token.`);
  }

  const match = TOKEN_SHAPE_RE.exec(trimmed);
  if (!match) {
    // We already know trimmed starts with '{' and ends with '}' (checked
    // above) — the only way the shape regex can still fail is a nested or
    // extra brace in between, e.g. "{NUM{X}}".
    return err('NOT_A_TOKEN', `Token "${cellValue}" không đúng cấu trúc.`);
  }

  const inner = match[1];
  const parts = inner.split('|');
  if (parts.length > 3) {
    return err(
      'TOO_MANY_PARTS',
      `Token "{${inner}}" có nhiều hơn 3 phần. Dấu "|" không được dùng trong FORMAT ở phiên bản này.`,
    );
  }

  const [rawType, rawFormat = '', rawAggregate] = parts;
  const typeUpper = rawType.trim().toUpperCase();
  if (!VALID_TYPES.includes(typeUpper as FieldType)) {
    return err(
      'UNKNOWN_TYPE',
      `Kiểu "${rawType}" không hợp lệ. Dùng NUM, TEXT, DATE hoặc TIME.`,
    );
  }
  const type = typeUpper as FieldType;

  const warnings: TokenWarning[] = [];
  let aggregate: AggregateType = 'NONE';
  if (rawAggregate !== undefined) {
    const aggUpper = rawAggregate.trim().toUpperCase();
    if (aggUpper === 'AGV') {
      aggregate = 'AVG';
      warnings.push({
        code: 'AGV_ALIAS_NORMALIZED',
        message: 'Đã hiểu "AGV" là ý định AVG và chuẩn hoá thành AVG.',
      });
    } else if (VALID_AGGREGATES.includes(aggUpper as AggregateType)) {
      aggregate = aggUpper as AggregateType;
    } else {
      return err(
        'UNKNOWN_AGGREGATE',
        `Tổng hợp "${rawAggregate}" không hợp lệ. Dùng SUM, AVG, MIN, MAX, COUNT, NONE.`,
      );
    }
  }

  if (!TYPE_AGGREGATE_COMPATIBILITY[type].includes(aggregate)) {
    return err(
      'AGGREGATE_TYPE_MISMATCH',
      `Kiểu ${type} không hỗ trợ tổng hợp ${aggregate}.`,
    );
  }

  return {
    ok: true,
    token: { type, format: rawFormat, aggregate, warnings },
  };
}
