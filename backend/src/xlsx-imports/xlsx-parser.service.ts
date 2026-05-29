/**
 * v0.47 PR5 — xlsx parser writing ONLY to staging.
 *
 * IRON RULE: this service NEVER calls prisma.case.create / prisma.incident.create
 * or any other mutation against real domain tables. It writes parsed rows to
 * `xlsx_import_staging` rows tagged with importLogId. The commit endpoint
 * (PR6) reads staging and decides what to materialise after dual-confirm.
 *
 * Codex CRITICAL #3 (staging vs direct upsert), #4 (formula stripping on import).
 */

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertWorkbookLimits,
  clampCellLength,
  stripImportFormula,
  withParserTimeout,
  XLSX_LIMITS,
  HostileXlsxError,
} from './hostile-xlsx-guard';

export interface ParseResult {
  totalRowsStaged: number;
  sheetsParsed: string[];
  truncatedCellCount: number;
  formulaStrippedCellCount: number;
}

/**
 * Maps a Vietnamese sheet name to the detectedType field for staging.
 * Phụ lục 01/02/03 → Incident, Phụ lục 04/05/06 → Case (matches PR4 generator).
 * Returns null for unmappable sheets so commit can skip them.
 */
function detectRowType(sheetName: string): string | null {
  const normalized = sheetName.toLowerCase().normalize('NFC');
  if (/ph[uụ]\s*l[uụ]c\s*0?[1-3]/.test(normalized) || /pl\s*[1-3]\b/.test(normalized))
    return 'Incident';
  if (/ph[uụ]\s*l[uụ]c\s*0?[4-6]/.test(normalized) || /pl\s*[4-6]\b/.test(normalized))
    return 'Case';
  return null;
}

@Injectable()
export class XlsxParserService {
  private readonly logger = new Logger(XlsxParserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse a buffer and write every data row to xlsx_import_staging.
   * Returns parser stats so the caller can populate XlsxImportLog counts.
   */
  async parseToStaging(buffer: Buffer, importLogId: string): Promise<ParseResult> {
    return withParserTimeout(async () => {
      const workbook = new ExcelJS.Workbook();
      // exceljs `xlsx.load` validates ZIP structure; XXE/billion-laughs is handled
      // by the underlying xml parser (sax-js / xml2js — both have known mitigations
      // as of exceljs 4.x; CVE-2023-* tracked in lock).
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      assertWorkbookLimits(workbook);

      let totalRowsStaged = 0;
      let truncatedCellCount = 0;
      let formulaStrippedCellCount = 0;
      const sheetsParsed: string[] = [];

      for (const sheet of workbook.worksheets) {
        sheetsParsed.push(sheet.name);
        const detectedType = detectRowType(sheet.name);

        // Header detection — first non-empty row is the header. We start staging
        // from the row after that. BCA phụ lục templates from PR4 use rows 1-6 for
        // header block, row 7 for column headers, data from row 8. We don't hard-code
        // that here — instead we scan top-down for the first row with "STT" or "Mã"
        // and treat everything after as data.
        let dataStartRow = 1;
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const cellA = row.getCell(1).value;
          if (
            typeof cellA === 'string' &&
            (/^STT$/i.test(cellA.trim()) || /^M[ãa]\s*(VV|VA|s[ốo])/i.test(cellA.trim()))
          ) {
            dataStartRow = rowNumber + 1;
          }
        });

        const stagingRows: Array<{
          importLogId: string;
          sheetName: string;
          rowIndex: number;
          payload: Record<string, unknown>;
          detectedType: string | null;
          conflictReason: string | null;
        }> = [];

        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber < dataStartRow) return;

          const payload: Record<string, unknown> = {};
          let rowHasContent = false;
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            let value: unknown = cell.value;
            // exceljs returns rich-text objects / formula objects — coerce to text
            if (value && typeof value === 'object' && !(value instanceof Date)) {
              const objVal = value as Record<string, unknown>;
              if (typeof objVal.result !== 'undefined') {
                // Formula cell — take the cached result, not the formula text.
                value = objVal.result;
                formulaStrippedCellCount++;
              } else if (typeof objVal.richText === 'object' && objVal.richText) {
                value = (objVal.richText as Array<{ text: string }>)
                  .map((r) => r.text)
                  .join('');
              } else if (typeof objVal.text === 'string') {
                value = objVal.text;
              } else if (typeof objVal.hyperlink === 'string') {
                value = String(objVal.hyperlink);
              }
            }

            // Strip leading formula triggers from raw strings too — defends the
            // path where an attacker writes `=cmd|...` as a plain string cell
            // (not a formula object). After this, no staging row can carry an
            // executable formula payload.
            const before = value;
            value = stripImportFormula(value);
            if (typeof before === 'string' && value !== before) {
              formulaStrippedCellCount++;
            }

            // Length clamp
            const clamped = clampCellLength(value);
            if (clamped.truncated) truncatedCellCount++;
            value = clamped.value;

            if (value !== null && value !== undefined && value !== '') {
              payload[`col${colNumber}`] = value;
              rowHasContent = true;
            }
          });

          if (rowHasContent) {
            stagingRows.push({
              importLogId,
              sheetName: sheet.name,
              rowIndex: rowNumber,
              payload,
              detectedType,
              conflictReason: null,
            });
          }
        });

        if (stagingRows.length > 0) {
          // Bulk insert per sheet — keeps tx duration tight. Prisma JSON column
          // typing requires casting our Record<string, unknown> payloads to its
          // InputJsonValue shape; the values are already coerced to primitives
          // by the formula/clamp pass above so this is safe.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await this.prisma.xlsxImportStaging.createMany({ data: stagingRows as any });
          totalRowsStaged += stagingRows.length;
        }
      }

      this.logger.log(
        `xlsx parsed: importLogId=${importLogId} rows=${totalRowsStaged} sheets=${sheetsParsed.length} truncated=${truncatedCellCount} formulaStripped=${formulaStrippedCellCount}`,
      );

      return {
        totalRowsStaged,
        sheetsParsed,
        truncatedCellCount,
        formulaStrippedCellCount,
      };
    }, XLSX_LIMITS.PARSER_TIMEOUT_MS);
  }
}
