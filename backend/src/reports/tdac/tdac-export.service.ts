import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { ReportTdcDraft } from '@prisma/client';

const TEMPLATE_DIR = path.resolve(__dirname, '../../../../assets/templates');
const TEMPLATES: Record<string, string> = {
  VU_AN: path.join(TEMPLATE_DIR, 'phu-luc-08-vu-an.xlsx'),
  VU_VIEC: path.join(TEMPLATE_DIR, 'phu-luc-08-vu-viec.xlsx'),
};

// Cell mapping: rowKey → { total: cellAddress, byTeamIndex: cellAddress[] }
// Teams are assumed in order: Tổ4 (col D), Tổ5 (col E), Tổ10 (col F)
// Starting Excel row = 8 for row 1, then increments
const ROW_TO_EXCEL_ROW: Record<string, number> = {
  '1': 8,
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
  '3.1': 19,
  '3.2': 20,
  '3.3': 21,
  '3.3.1': 22,
  '3.3.2': 23,
  '3.3.3': 24,
  '3.3.4': 25,
  '3.3.5': 26,
  '4': 27,
  '5': 28,
  '5.1': 29,
  '5.2': 30,
  '5.3': 31,
  '5.4': 32,
  '5.5': 33,
  '5.6.1': 34,
  '5.6.2': 35,
  '5.6.3': 36,
  '5.6.4': 37,
  '5.6.5': 38,
  '5.6.6': 39,
  '5.6.7': 40,
  '5.6.8': 41,
};

// Column mapping: total=C, team[0]=D, team[1]=E, team[2]=F
const COL_TOTAL = 'C';
const TEAM_COLS = ['D', 'E', 'F'];

@Injectable()
export class TdacExportService implements OnModuleInit {
  private readonly logger = new Logger(TdacExportService.name);

  onModuleInit() {
    for (const [type, templatePath] of Object.entries(TEMPLATES)) {
      if (!fs.existsSync(templatePath)) {
        this.logger.warn(
          `Template file not found for ${type}: ${templatePath}. Export will be unavailable until the file is added.`,
        );
      } else {
        this.logger.log(`Template verified: ${templatePath}`);
      }
    }
  }

  async export(draft: ReportTdcDraft, res: Response): Promise<void> {
    const loaiBaoCao = draft.loaiBaoCao as string;
    const templatePath = TEMPLATES[loaiBaoCao];

    if (!templatePath || !fs.existsSync(templatePath)) {
      throw new ServiceUnavailableException(
        `Template file not found for ${loaiBaoCao}. Please contact system administrator.`,
      );
    }

    // Use adjustedData if available, else fall back to computedData
    const data = (draft.adjustedData ?? draft.computedData) as {
      rows?: Array<{
        rowKey: string;
        total: number;
        byTeam: Array<{ teamId: string; value: number }>;
      }>;
    };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new ServiceUnavailableException('Template file is invalid: no worksheets found');
    }

    // Fill cells
    if (data?.rows && Array.isArray(data.rows)) {
      for (const row of data.rows) {
        const excelRow = ROW_TO_EXCEL_ROW[row.rowKey];
        if (!excelRow) continue;

        // Total column
        const totalCell = worksheet.getCell(`${COL_TOTAL}${excelRow}`);
        totalCell.value = row.total ?? 0;

        // Team columns
        if (Array.isArray(row.byTeam)) {
          row.byTeam.forEach((teamEntry, idx) => {
            if (idx >= TEAM_COLS.length) return;
            const col = TEAM_COLS[idx];
            const cell = worksheet.getCell(`${col}${excelRow}`);
            cell.value = teamEntry.value ?? 0;
          });
        }
      }
    }

    const filename = `phu-luc-08-${loaiBaoCao.toLowerCase().replace(/_/g, '-')}-${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
  }
}
