import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { MonthlyReportSnapshot } from './monthly-report.rules';

type WorkbookKind = 'DETAIL' | 'SUMMARY';

const TEMPLATE_FILES: Record<WorkbookKind, string> = {
  DETAIL: 'MAU_BAO_CAO_THANG_PHU_LUC_01_06.xlsx',
  SUMMARY: 'MAU_BAO_CAO_THANG_PHU_LUC_07_08.xlsx',
};

const DETAIL_COLUMNS: Record<string, string[]> = {
  PL01: [
    'crime',
    'receivedDate',
    'reporter',
    'summary',
    'assignment',
    'processing',
    'notProsecuted',
    'transferred',
    'evidence',
    'storage',
    'officer',
    'registration',
    'newOfficer',
    'note',
  ],
  PL02: [
    'crime',
    'receivedDate',
    'reporter',
    'summary',
    'assignment',
    'suspensionDecision',
    'suspensionReason',
    'evidence',
    'expiryDate',
    'notProsecuted',
    'officer',
    'registration',
    'recordState',
    'archiveNumber',
    'archiveUnit',
    'newOfficer',
    'crimeLevel',
    'location',
    'prosecutor',
  ],
  PL03: [
    'crime',
    'receivedDate',
    'reporter',
    'summary',
    'assignment',
    'suspensionDecision',
    'suspensionReason',
    'suspect',
    'evidence',
    'storage',
    'expiryDate',
    'remediationMinutes',
    'remediationProgress',
    'recoveryDecision',
    'result',
    'officer',
    'registration',
    'recordState',
    'archiveNumber',
    'archiveUnit',
    'relatedContent',
    'relatedRegistration',
    'newOfficer',
    'crimeLevel',
    'location',
    'prosecutor',
  ],
  PL04: [
    'crime',
    'summary',
    'prosecutionDecision',
    'investigating',
    'conclusion',
    'dismissal',
    'transferred',
    'subjectDecision',
    'subjectName',
    'birthYear',
    'address',
    'evidence',
    'storage',
    'officer',
    'registration',
    'newOfficer',
    'note',
  ],
  PL05: [
    'crime',
    'summary',
    'prosecutionDecision',
    'suspensionDecision',
    'subjectDecision',
    'subjectSuspension',
    'subjectName',
    'birthYear',
    'address',
    'suspensionReason',
    'evidence',
    'expiryDate',
    'caseDismissal',
    'subjectDismissal',
    'officer',
    'registration',
    'recordState',
    'archiveNumber',
    'archiveUnit',
    'newOfficer',
    'crimeLevel',
    'location',
    'prosecutor',
  ],
  PL06: [
    'crime',
    'summary',
    'prosecutionDecision',
    'suspensionDecision',
    'subjectDecision',
    'subjectSuspension',
    'subjectName',
    'birthYear',
    'address',
    'suspensionReason',
    'suspect',
    'evidence',
    'storage',
    'expiryDate',
    'remediationMinutes',
    'remediationProgress',
    'recoveryDecision',
    'result',
    'officer',
    'registration',
    'recordState',
    'archiveNumber',
    'archiveUnit',
    'relatedContent',
    'relatedRegistration',
    'newOfficer',
    'crimeLevel',
    'location',
    'prosecutor',
  ],
};

const PL07_ROWS: Record<string, number> = {
  '1': 5,
  '1.1': 6,
  '1.2': 7,
  '1.3': 8,
  '2': 9,
  '2.1': 10,
  '2.2': 11,
  '2.3': 12,
  '2.4': 13,
  '2.5': 14,
  '2.6': 15,
  '3': 16,
  '3.1': 18,
  '3.2': 19,
  '3.3': 20,
  '3.3.1': 21,
  '3.3.2': 22,
  '3.3.3': 23,
  '3.3.4': 24,
  '3.3.5': 25,
  '4': 26,
  '5': 27,
  '5.1': 28,
  '5.2': 29,
  '5.3': 30,
  '5.4': 31,
  '5.5': 32,
  '5.6': 33,
  '5.7': 34,
  '5.7.1': 35,
  '5.7.2': 36,
  '5.7.3': 37,
  '5.7.4': 38,
  '5.7.5': 39,
  '5.7.6': 40,
};
const PL08_ROWS: Record<string, number> = {
  '1': 6,
  '1.1': 7,
  '1.2': 8,
  '2': 9,
  '2.1': 10,
  '2.2': 11,
  '2.3': 12,
  '2.4': 13,
  '2.5': 14,
  '2.6': 15,
  '2.7': 16,
  '2.8': 17,
  '3': 18,
  '3.1': 20,
  '3.2': 21,
  '3.3': 22,
  '3.3.1': 23,
  '3.3.2': 24,
  '3.3.3': 25,
  '3.3.4': 26,
  '3.3.5': 27,
  '4': 28,
  '5': 29,
  '5.1': 30,
  '5.2': 31,
  '5.3': 32,
  '5.4': 33,
  '5.5': 34,
  '5.6': 35,
  '5.6.1': 36,
  '5.6.2': 37,
  '5.6.3': 38,
  '5.6.4': 39,
  '5.6.5': 40,
  '5.6.6': 41,
  '5.6.7': 42,
  '5.6.8': 43,
};

@Injectable()
export class MonthlyReportExportService {
  templatePath(kind: WorkbookKind, version = '2026.09'): string {
    const candidates = [
      path.resolve(
        process.cwd(),
        'templates',
        'xlsx',
        'monthly-reports',
        version,
        TEMPLATE_FILES[kind],
      ),
      path.resolve(
        __dirname,
        '../../../templates/xlsx/monthly-reports',
        version,
        TEMPLATE_FILES[kind],
      ),
    ];
    return (
      candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
    );
  }

  async render(
    kind: WorkbookKind,
    snapshot: MonthlyReportSnapshot,
  ): Promise<Buffer> {
    for (const appendix of snapshot.appendices) {
      if (appendix.rows.length > 1_048_540)
        throw new BadRequestException(
          `${appendix.code} vượt giới hạn dòng của một sheet Excel`,
        );
    }
    const template = this.templatePath(kind, snapshot.templateVersion);
    if (!fs.existsSync(template))
      throw new ServiceUnavailableException(`Thiếu mẫu báo cáo tháng ${kind}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    if (kind === 'DETAIL') this.fillDetail(workbook, snapshot);
    else this.fillSummary(workbook, snapshot);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private fillDetail(
    workbook: ExcelJS.Workbook,
    snapshot: MonthlyReportSnapshot,
  ): void {
    for (let index = 0; index < 6; index += 1) {
      const appendix = snapshot.appendices.find(
        (item) => item.code === `PL0${index + 1}`,
      );
      const sheet = workbook.worksheets[index];
      if (!appendix || !sheet) continue;
      sheet.getCell('A1').value = snapshot.unitName;
      sheet.getCell(index < 4 ? 'H2' : 'D2').value =
        `Mốc thời gian: tính đến ngày ${this.viDate(snapshot.periodEnd)}`;
      const startRow = index < 4 ? 6 : 7;
      this.ensureRows(sheet, startRow, appendix.rows.length, 3);
      const keys = DETAIL_COLUMNS[appendix.code] ?? [];
      appendix.rows.forEach((item, rowIndex) => {
        const row = sheet.getRow(startRow + rowIndex);
        row.getCell(1).value = rowIndex + 1;
        keys.forEach((key, columnIndex) => {
          row.getCell(columnIndex + 2).value = item.cells[key] ?? '';
        });
      });
    }
  }

  private ensureRows(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    required: number,
    placeholders: number,
  ): void {
    if (required <= placeholders) return;
    const templateRow = sheet.getRow(startRow + placeholders - 1);
    for (let i = 0; i < required - placeholders; i += 1) {
      const inserted = sheet.insertRow(startRow + placeholders + i, []);
      inserted.height = templateRow.height;
      templateRow.eachCell({ includeEmpty: true }, (cell, column) => {
        inserted.getCell(column).style = { ...cell.style };
      });
    }
  }

  private fillSummary(
    workbook: ExcelJS.Workbook,
    snapshot: MonthlyReportSnapshot,
  ): void {
    for (const code of ['PL07', 'PL08'] as const) {
      const appendix = snapshot.appendices.find((item) => item.code === code);
      const sheet = workbook.worksheets[code === 'PL07' ? 0 : 1];
      if (!appendix || !sheet) continue;
      sheet.getCell('A1').value = snapshot.unitName;
      sheet.getCell(code === 'PL07' ? 'B2' : 'C2').value =
        `Mốc thời gian: từ ngày ${this.viDate(snapshot.periodStart)} đến ngày ${this.viDate(snapshot.periodEnd)}`;
      for (const item of appendix.metrics) {
        const baseKey = item.key.replace(/\.(case|subject)$/, '');
        const row = (code === 'PL07' ? PL07_ROWS : PL08_ROWS)[baseKey];
        if (!row) continue;
        const column = code === 'PL08' && item.key.endsWith('.subject') ? 5 : 4;
        sheet.getCell(row, column).value = item.value;
      }
    }
  }

  private viDate(value: string): string {
    return new Date(value).toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  }
}
