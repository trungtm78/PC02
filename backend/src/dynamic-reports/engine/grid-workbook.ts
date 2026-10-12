import type { GridCell, GridModel } from './grid-types';
import { WorkbookEvaluator } from './workbook-eval';
import type { InputType, WorkbookCell, WorkbookModel } from './workbook-eval';

/**
 * The bridge from what a template looks like (GridModel) to what can be
 * calculated (WorkbookModel). Browser, server and exported file all use this
 * one function, so a formula is worked out the same way everywhere (plan GA1):
 * the web page that shows 105, the snapshot that stores 105 and the Excel file
 * that carries 105 cannot drift apart.
 *
 * Which cells are inputs is NOT in the GridModel (it lives in the report's
 * fields); it is joined in here. An input overrides whatever the file holds in
 * that cell — a template's unlocked cells often contain a sample number, and
 * the submitted value must win over it.
 *
 * Pure: no imports from Nest, Prisma or the file system.
 */

export interface InputFieldRef {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: InputType;
}

function toWorkbookCell(cell: GridCell): WorkbookCell | null {
  switch (cell.k) {
    case 'num':
      return { kind: 'number', value: cell.v };
    case 'bool':
      // Stays a boolean: ranges ignore it, as in Excel.
      return { kind: 'boolean', value: cell.v };
    case 'text':
      return { kind: 'text', value: cell.v };
    case 'formula':
      return { kind: 'formula', source: cell.f };
    case 'empty':
      return null;
  }
}

export function toWorkbookModel(
  grid: GridModel,
  fields: readonly Pick<InputFieldRef, 'sheetKey' | 'address' | 'type'>[],
): WorkbookModel {
  return {
    sheets: grid.sheets.map((sheet) => {
      const cells: Record<string, WorkbookCell> = {};
      for (const [address, cell] of Object.entries(sheet.cells)) {
        const wc = toWorkbookCell(cell);
        if (wc) cells[address] = wc;
      }
      for (const f of fields) {
        if (f.sheetKey === sheet.name) cells[f.address] = { kind: 'input', type: f.type };
      }
      return { name: sheet.name, cells };
    }),
    excludedSheets: grid.excludedSheets,
  };
}

/**
 * Evaluates a template with a set of submitted values.
 *
 * @param values  field key → stored text (canonical number, ISO date, …) or null/'' for blank
 * @param blankAs `'blank'` while entering (an empty input behaves as in Excel),
 *                `'none'` when aggregating (a missing contribution is not a zero)
 */
export function evaluateGridWorkbook(
  grid: GridModel,
  fields: readonly InputFieldRef[],
  values: Readonly<Record<string, string | null | undefined>>,
  blankAs: 'blank' | 'none' = 'blank',
): { evaluator: WorkbookEvaluator; inputs: Record<string, string | null> } {
  const inputs: Record<string, string | null> = {};
  for (const f of fields) {
    const raw = values[f.fieldKey];
    inputs[f.fieldKey] = raw === undefined || raw === '' ? null : raw;
  }
  const evaluator = new WorkbookEvaluator(toWorkbookModel(grid, fields), inputs, { blankAs });
  return { evaluator, inputs };
}
