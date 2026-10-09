import * as ExcelJS from 'exceljs';
import { resolveEffectiveLocked } from './locked';
import { classifyCell } from './classify';
import { inferLabel } from './label';
import { detectUnsupportedFeatures } from './unsupported-features';
import { assertTemplateLimits } from './limits';
import { extractLayout } from './layout';
import type {
  ParsedField,
  ParsedFormulaCell,
  ParsedIssue,
  ParseTemplateResult,
} from './types';

/**
 * TemplateService parser core (spec §10 PR3). Not a pure engine (R2
 * exception, declared in the plan): it depends on `exceljs` and reads a
 * real file buffer, so it stays backend-only.
 *
 * Shared-formula expansion needs no code here — exceljs's own `cell.formula`
 * getter already translates a shared (slave) formula relative to its
 * master (verified empirically against `bao_cao_ngay_shared_formulas.xlsx`:
 * 193/193 slave cells translate correctly). We only need to always read
 * `.formula`, never `cell.value.formula` (undefined on slave cells).
 */

function cellPlainText(cell: ExcelJS.Cell): string | number | boolean | null {
  switch (cell.type) {
    case ExcelJS.ValueType.String:
    case ExcelJS.ValueType.SharedString:
      return typeof cell.value === 'string' ? cell.value : null;
    case ExcelJS.ValueType.RichText: {
      const v = cell.value as { richText?: { text: string }[] } | null;
      return v?.richText ? v.richText.map((r) => r.text).join('') : null;
    }
    case ExcelJS.ValueType.Number:
      return typeof cell.value === 'number' ? cell.value : null;
    case ExcelJS.ValueType.Boolean:
      return typeof cell.value === 'boolean' ? cell.value : null;
    default:
      return null;
  }
}

function cellLocked(cell: ExcelJS.Cell): boolean | undefined {
  return cell.style?.protection?.locked;
}

function rowLocked(row: ExcelJS.Row): boolean | undefined {
  return row.protection?.locked;
}

function columnLocked(column: ExcelJS.Column): boolean | undefined {
  return column.style?.protection?.locked;
}

/**
 * Parse an already-validated xlsx buffer (file-level hostile-xlsx-guard
 * checks — magic bytes, zip-bomb, sheet/row caps — must already have run;
 * this function does not repeat them). `selectedSheetNames` are the sheets
 * the author picked as report sheets in the wizard; every other sheet in
 * the workbook is ignored entirely (spec §10 R6/R3: a 3-D formula or
 * `#REF!` outside the selection is not even inspected).
 */
export async function parseTemplate(
  buffer: Buffer,
  selectedSheetNames: string[],
): Promise<ParseTemplateResult> {
  const workbook = new ExcelJS.Workbook();
  // Same cast as xlsx-parser.service.ts — exceljs's bundled @types expect an
  // older Buffer/ArrayBuffer shape than the project's current @types/node.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const dateSystem: ParseTemplateResult['dateSystem'] = (
    workbook as unknown as { properties?: { date1904?: boolean } }
  ).properties?.date1904
    ? '1904'
    : '1900';

  const fields: ParsedField[] = [];
  const formulas: ParsedFormulaCell[] = [];
  const issues: ParsedIssue[] = await detectUnsupportedFeatures(buffer);
  let totalCells = 0;
  let inputCellCount = 0;

  for (const sheetName of selectedSheetNames) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      issues.push({
        sheetKey: sheetName,
        address: '',
        code: 'UNSUPPORTED_FEATURE',
        severity: 'ERROR',
        message: `Không tìm thấy sheet "${sheetName}" trong file.`,
      });
      continue;
    }

    const getCellText = (row: number, col: number): string | number | null => {
      const v = cellPlainText(sheet.getCell(row, col));
      return typeof v === 'boolean' ? null : v;
    };

    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        totalCells++;

        const hasFormula = cell.type === ExcelJS.ValueType.Formula;
        const isMergeNonAnchor = cell.type === ExcelJS.ValueType.Merge;
        const column = sheet.getColumn(colNumber);
        const locked = resolveEffectiveLocked(
          cellLocked(cell),
          rowLocked(row),
          columnLocked(column),
        );
        const isHidden = row.hidden === true || column.hidden === true;
        const rawValue = hasFormula ? null : cellPlainText(cell);

        const result = classifyCell({
          locked,
          hasFormula,
          rawValue,
          isMergeNonAnchor,
          isHidden,
        });

        for (const issue of result.issues) {
          issues.push({ sheetKey: sheetName, address: cell.address, ...issue });
        }

        if (result.classification === 'STATIC_FORMULA') {
          formulas.push({
            sheetKey: sheetName,
            address: cell.address,
            expression: cell.formula ?? '',
          });
        } else if (result.classification === 'INPUT_FIELD' && result.field) {
          inputCellCount++;
          const label = inferLabel(getCellText, rowNumber, colNumber);
          if (label === null) {
            issues.push({
              sheetKey: sheetName,
              address: cell.address,
              code: 'LABEL_REQUIRED',
              severity: 'ERROR',
              message:
                'Không suy ra được nhãn cho ô nhập này — phải đặt tên thủ công.',
            });
          }
          fields.push({
            sheetKey: sheetName,
            address: cell.address,
            fieldKey: `${sheetName}!${cell.address}`,
            label: label ?? '',
            type: result.field.type,
            format: result.field.format,
            aggregate: result.field.aggregate,
            source: 'TOKEN',
          });
        }
      });
    });
  }

  assertTemplateLimits({
    selectedSheetCount: selectedSheetNames.length,
    totalCells,
    inputCellCount,
  });

  const layout = extractLayout(workbook, selectedSheetNames);

  return {
    dateSystem,
    fields,
    formulas,
    issues,
    totalCells,
    inputCellCount,
    layout,
  };
}
