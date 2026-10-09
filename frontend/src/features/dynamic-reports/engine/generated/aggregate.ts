import Decimal from 'decimal.js';
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
 * a blank counts as 0, so it IS included in COUNT and in AVG's denominator.
 * Either way, an empty contributing set (no contributions at all, or every
 * contribution blank under IGNORE) yields `null` for SUM/AVG/MIN/MAX
 * ("—"), never a misleading 0 — except COUNT, which is always a real
 * number (0 on an empty set).
 */

export type BlankPolicy = 'ZERO' | 'IGNORE';

export interface Contribution {
  sourceId: string;
  value: number | null;
}

export interface AggregateResult {
  /** null = "—" (nothing to aggregate, or NONE aggregate type). Always a real number for COUNT. */
  value: number | null;
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
): number[] {
  if (policy === 'ZERO') {
    return contributions.map((c) => c.value ?? 0);
  }
  return contributions
    .filter((c) => c.value !== null)
    .map((c) => c.value as number);
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
      value: values.length,
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

  const decimals = values.map((v) => new Decimal(v));
  let result: Decimal;
  switch (aggregateType) {
    case 'SUM':
      result = decimals.reduce((acc, v) => acc.plus(v), new Decimal(0));
      break;
    case 'AVG':
      result = decimals
        .reduce((acc, v) => acc.plus(v), new Decimal(0))
        .dividedBy(decimals.length);
      break;
    case 'MIN':
      result = Decimal.min(...decimals);
      break;
    case 'MAX':
      result = Decimal.max(...decimals);
      break;
  }

  return {
    value: result.toNumber(),
    displayNotAggregated: false,
    contributors: contributions,
    countTotal,
    countNonBlank,
  };
}
