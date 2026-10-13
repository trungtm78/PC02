import DecimalBase from 'decimal.js';
import type { AggregateType } from './token';

/**
 * Aggregate engine — combines one field's per-source (per-team) values
 * into a single number (FRD §4.5, D03). Pure, no I/O. Validated against
 * an independent oracle computed from the real HSLN workbook outside this
 * codebase (spec §8/§10 R11) — never against the workbook's own cached
 * formula results, 190/228 of which are already stale `#REF!`.
 *
 * Two blank policies (D03): `IGNORE` is the FRD's original wording ("AVG
 * bỏ null, tính cả 0") — a blank contribution is excluded entirely, from
 * both the sum and the denominator. `ZERO` (the system default per D03) —
 * a blank counts as 0 in arithmetic and AVG's denominator. COUNT measures
 * entered numbers (including explicit zero), excluding blanks under either
 * policy, as required by the corrected AC-025 example.
 * Either way, an empty contributing set (no contributions at all, or every
 * contribution blank under IGNORE) yields `null` for SUM/AVG/MIN/MAX
 * ("—"), never a misleading 0 — except COUNT, which is always a real
 * number (0 on an empty set).
 */

/**
 * decimal.js keeps 20 significant digits by default; a field may hold 18, so a
 * total of a few hundred of them would be rounded. This copy keeps 60 — more
 * than any report can reach — and leaves every other user of decimal.js alone.
 */
const Decimal = DecimalBase.clone({ precision: 60 });
type Decimal = DecimalBase;

export type BlankPolicy = 'ZERO' | 'IGNORE';

/**
 * A contribution is a canonical DECIMAL STRING ("1234.5"), never a JS number:
 * a figure of 18 significant digits survives intact from the team's entry,
 * through the total, into the exported file (review OV4). Parsing to a double
 * here would round it silently.
 */
export interface Contribution {
  sourceId: string;
  value: string | null;
}

/** Digits kept after the point when a division (AVG) does not come out even. */
export const AVG_DECIMAL_PLACES = 12;

export interface AggregateResult {
  /** Canonical decimal string; null = "—" (nothing to aggregate, or NONE aggregate type). Always a number for COUNT. */
  value: string | null;
  /** true for aggregate type NONE — FRD: "— / Không tổng hợp", with drill-down still available via `contributors`. */
  displayNotAggregated: boolean;
  /** Every contribution as given, including blanks — for the S18 "nguồn số liệu" drill-down drawer. */
  contributors: Contribution[];
  countTotal: number;
  countNonBlank: number;
}

function resolveContributingValues(
  policy: BlankPolicy,
  contributions: Contribution[],
): Decimal[] {
  if (policy === 'ZERO') {
    return contributions.map((c) => new Decimal(c.value ?? '0'));
  }
  return contributions
    .filter((c) => c.value !== null)
    .map((c) => new Decimal(c.value as string));
}

export function aggregateValues(
  aggregateType: AggregateType,
  blankPolicy: BlankPolicy,
  contributions: Contribution[],
): AggregateResult {
  const countTotal = contributions.length;
  const countNonBlank = contributions.filter((c) => c.value !== null).length;

  if (aggregateType === 'NONE') {
    return {
      value: null,
      displayNotAggregated: true,
      contributors: contributions,
      countTotal,
      countNonBlank,
    };
  }

  const values = resolveContributingValues(blankPolicy, contributions);

  if (aggregateType === 'COUNT') {
    return {
      value: String(countNonBlank),
      displayNotAggregated: false,
      contributors: contributions,
      countTotal,
      countNonBlank,
    };
  }

  if (values.length === 0) {
    return {
      value: null,
      displayNotAggregated: false,
      contributors: contributions,
      countTotal,
      countNonBlank,
    };
  }

  const decimals = values;
  let result: Decimal;
  switch (aggregateType) {
    case 'SUM':
      result = decimals.reduce((acc, v) => acc.plus(v), new Decimal(0));
      break;
    case 'AVG':
      result = decimals
        .reduce((acc, v) => acc.plus(v), new Decimal(0))
        .dividedBy(decimals.length)
        .toDecimalPlaces(AVG_DECIMAL_PLACES);
      break;
    case 'MIN':
      result = Decimal.min(...decimals);
      break;
    case 'MAX':
      result = Decimal.max(...decimals);
      break;
  }

  return {
    value: result.toFixed(),
    displayNotAggregated: false,
    contributors: contributions,
    countTotal,
    countNonBlank,
  };
}
