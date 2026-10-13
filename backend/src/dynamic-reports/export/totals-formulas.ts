import { MAX_FORMULA_LENGTH } from '../engine/expr';

/**
 * The formula that makes a totals cell recalculate from the teams' own sheets.
 *
 * It must give, when Excel works it out, exactly what `engine/aggregate.ts` gives for the same teams — that is what the
 * screen and the closed period show — so the blank policy is spelled out rather than left to Excel's habits:
 *
 *  - ZERO  a blank counts as 0 and is part of COUNT and of AVG's divisor. Excel's SUM already treats a blank as 0;
 *          AVG is the sum over the number of teams; MIN/MAX add 0 to each cell (`ref+0`: a blank becomes 0, MIN/MAX
 *          alone would skip it); COUNT is the number of teams, which is a constant, not a formula.
 *  - IGNORE a blank is left out of everything. When EVERY cell is blank the system says "—", Excel's SUM would say 0:
 *          the formula returns "" in that case.
 *
 * Excel takes at most 255 arguments in a function and 8,192 characters in a formula, so a long list of teams is cut
 * into groups that are combined by the same function (SUM of SUMs, MIN of MINs, a COUNT as the SUM of COUNTs): every
 * one of these composes, which is why AVERAGE is only used when everything fits in one group.
 */

export type TotalsAggregate = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
export type TotalsBlankPolicy = 'ZERO' | 'IGNORE';

/** Well under Excel's 255 arguments. */
export const FORMULA_GROUP_SIZE = 100;

/** The engine keeps 12 decimals of an average (AVG_DECIMAL_PLACES); Excel keeps more, so the formula rounds the same way. */
const AVG_DECIMALS = 12;

/**
 * Stands in for a group of cells that are ALL blank inside a MIN / MAX of groups. Excel answers 0 for MIN or MAX of nothing,
 * which would win a MIN over real figures; a number no figure of the report can reach (they hold 18 digits at most) cannot.
 * Written out in full: the parser takes no exponent notation.
 */
const UNREACHABLE = '100000000000000000000';

export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/**
 * MIN / MAX over cells that may be blank, skipping the blanks, in groups. A group with no figure in it must not answer 0
 * (Excel's MIN of nothing), so it answers the sentinel on the losing side instead; the caller has already checked
 * that some cell holds a figure, so the sentinel never reaches the result.
 */
function foldExtreme(fn: 'MIN' | 'MAX', refs: string[]): string {
  if (refs.length <= FORMULA_GROUP_SIZE) return `${fn}(${refs.join(',')})`;
  const losing = fn === 'MIN' ? UNREACHABLE : `-${UNREACHABLE}`;
  const groups: string[] = [];
  for (let i = 0; i < refs.length; i += FORMULA_GROUP_SIZE) {
    const group = refs.slice(i, i + FORMULA_GROUP_SIZE).join(',');
    groups.push(`IF(COUNT(${group})=0,${losing},${fn}(${group}))`);
  }
  return fold(fn, groups);
}

/** `fn` over the arguments, in groups when there are more than fit in one call. */
function fold(fn: string, args: string[]): string {
  if (args.length <= FORMULA_GROUP_SIZE) return `${fn}(${args.join(',')})`;
  const groups: string[] = [];
  for (let i = 0; i < args.length; i += FORMULA_GROUP_SIZE) {
    groups.push(`${fn}(${args.slice(i, i + FORMULA_GROUP_SIZE).join(',')})`);
  }
  return fold(fn, groups);
}

function countOf(refs: string[]): string {
  if (refs.length <= FORMULA_GROUP_SIZE) return `COUNT(${refs.join(',')})`;
  const groups: string[] = [];
  for (let i = 0; i < refs.length; i += FORMULA_GROUP_SIZE) {
    groups.push(`COUNT(${refs.slice(i, i + FORMULA_GROUP_SIZE).join(',')})`);
  }
  return fold('SUM', groups);
}

/**
 * The formula of one totals cell, or null when it stays a plain number (nothing to add up, COUNT with the ZERO policy
 * which is just the number of teams, or a formula that would not fit in an Excel cell).
 * `sheetNames` are the sheets of the teams that count, in the order of the file; `address` is the cell on each of them.
 */
export function buildTotalsFormula(input: {
  aggregate: TotalsAggregate;
  blankPolicy: TotalsBlankPolicy;
  sheetNames: string[];
  address: string;
}): string | null {
  const { aggregate, blankPolicy, sheetNames, address } = input;
  const n = sheetNames.length;
  if (n === 0) return null;
  const refs = sheetNames.map((s) => `${quoteSheetName(s)}!${address}`);
  const ignoring = blankPolicy === 'IGNORE';

  let formula: string | null;
  switch (aggregate) {
    case 'SUM':
      formula = ignoring ? `IF(${countOf(refs)}=0,"",${fold('SUM', refs)})` : fold('SUM', refs);
      break;
    case 'AVG':
      if (!ignoring) formula = `ROUND(${fold('SUM', refs)}/${n},${AVG_DECIMALS})`;
      else if (n <= FORMULA_GROUP_SIZE) {
        formula = `IF(COUNT(${refs.join(',')})=0,"",ROUND(AVERAGE(${refs.join(',')}),${AVG_DECIMALS}))`;
      } else formula = `IF(${countOf(refs)}=0,"",ROUND(${fold('SUM', refs)}/${countOf(refs)},${AVG_DECIMALS}))`;
      break;
    case 'MIN':
    case 'MAX':
      formula = ignoring
        ? `IF(${countOf(refs)}=0,"",${foldExtreme(aggregate, refs)})`
        : fold(aggregate, refs.map((r) => `${r}+0`));
      break;
    case 'COUNT':
      formula = ignoring ? countOf(refs) : null;
      break;
  }
  if (formula === null || formula.length > MAX_FORMULA_LENGTH) return null;
  return formula;
}
