import { evaluateGridWorkbook } from '../engine/grid-workbook';
import type { InputFieldRef } from '../engine/grid-workbook';
import { describeFormulaError } from '../engine/numfmt';
import type { FormulaErrorCode } from '../engine/numfmt';
import type { GridModel } from '../engine/grid-types';

/**
 * What the file carries as the "last calculated" value of each formula.
 *
 * Excel recalculates when it opens the file, so these only matter for viewers
 * that do not (a phone's file preview, a mail client). The rule that follows is
 * to show a number only when we are sure of it. A formula the engine cannot
 * evaluate — an array formula, a construct outside its grammar, a date used in
 * arithmetic — gets NO cached value (a blank in a preview) rather than a
 * confident wrong one. The one failure that is a real answer in Excel too,
 * division by zero, is written as Excel's own "#DIV/0!".
 *
 * Pure: runs inside the export worker, so a large model costs that thread's
 * time and heap limits, never the server's.
 */

export type FormulaResult =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; value: string }
  /** No cached value: let the viewer show nothing rather than something wrong. */
  | { kind: 'none' };

export function computeFormulaResults(
  model: GridModel,
  fields: readonly InputFieldRef[],
  values: Readonly<Record<string, string | null | undefined>>,
): Record<string, FormulaResult> {
  const { evaluator } = evaluateGridWorkbook(model, fields, values);
  const out: Record<string, FormulaResult> = {};
  for (const sheet of model.sheets) {
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (cell.k !== 'formula') continue;
      const outcome = evaluator.get(sheet.name, address);
      const key = `${sheet.name}!${address}`;
      if (!outcome || !outcome.ok) {
        const code = (outcome && !outcome.ok ? outcome.error.code : 'CYCLE_DETECTED') as FormulaErrorCode;
        out[key] = code === 'DIV_BY_ZERO' ? { kind: 'error', value: describeFormulaError(code).text } : { kind: 'none' };
        continue;
      }
      const v = outcome.value;
      if (v.type === 'number') out[key] = { kind: 'number', value: Number(v.value) };
      else if (v.type === 'string') out[key] = { kind: 'string', value: v.value };
      else out[key] = { kind: 'boolean', value: v.value };
    }
  }
  return out;
}
