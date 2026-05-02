import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { BcaExcelHelper } from '../common/bca-excel.helper';

// ─────────────────────────────────────────────────────────────────────────────
// Types matching the shape returned by ReportsService
// ─────────────────────────────────────────────────────────────────────────────

interface MonthlyRow {
  month: string;
  donThu: number;
  vuViec: number;
  vuAn: number;
  daGiaiQuyet: number;
}

interface MonthlyData {
  data: MonthlyRow[];
  totals: { donThu: number; vuViec: number; vuAn: number; daGiaiQuyet: number };
  year: number;
  month?: number;
}

interface QuarterlyRow {
  quarter: string;
  donThu: number;
  vuViec: number;
  vuAn: number;
  daGiaiQuyet: number;
}

interface QuarterlyData {
  data: QuarterlyRow[];
  totals: { donThu: number; vuViec: number; vuAn: number; daGiaiQuyet: number };
  year: number;
  quarter?: number;
}

interface Stat48FieldResult {
  field: string;
  type: 'numeric' | 'categorical';
  total?: number;
  distribution?: Record<string, number>;
  dataCount: number;
  nullCount: number;
}

interface Stat48Group {
  name: string;
  fields: Stat48FieldResult[];
}

interface Stat48Data {
  totalCases: number;
  nullCount: number;
  nullRatePct: number;
  isDraft: boolean;
  fromDate: string;
  toDate: string;
  unit?: string;
  groups: Stat48Group[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NAVY_ARGB = 'FF1B2B4E';
const WHITE_ARGB = 'FFFFFFFF';

function applyNavyHeader(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font = { bold: true, color: { argb: WHITE_ARGB }, size: 13 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
}

function applyColumnHeaders(row: ExcelJS.Row, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: WHITE_ARGB } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_ARGB } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  row.height = 22;
}

function borderCell(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  };
}

function setXlsxHeaders(res: Response, filename: string) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsExportService {
  // ── Monthly export ─────────────────────────────────────────────────────────

  async exportMonthly(data: MonthlyData, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo tháng');
    const COL_COUNT = 6;
    const HEADERS = ['Đơn vị', 'Đơn thư', 'Vụ việc', 'Vụ án', 'Đã giải quyết', 'Tỷ lệ %'];
    const WIDTHS = [20, 12, 12, 12, 16, 12];

    const title = data.month
      ? `BẢNG THỐNG KÊ THÁNG ${data.month}/${data.year}`
      : `BẢNG THỐNG KÊ NĂM ${data.year}`;
    const period = data.month
      ? `Kỳ báo cáo: Tháng ${data.month} năm ${data.year}`
      : `Kỳ báo cáo: Năm ${data.year}`;

    // BCA professional header (rows 1-6)
    BcaExcelHelper.addHeader(sheet, COL_COUNT, title, period);

    // Column headers (row 7)
    BcaExcelHelper.addColumnHeaders(sheet.getRow(7), HEADERS, WIDTHS);
    sheet.getRow(7).height = 22;

    // Data rows (row 8+)
    data.data.forEach((row, idx) => {
      const total = row.donThu + row.vuViec + row.vuAn;
      const tyLe = total > 0 ? Math.round((row.daGiaiQuyet / total) * 100) : 0;
      const excelRow = sheet.getRow(idx + 8);
      const values = [row.month, row.donThu, row.vuViec, row.vuAn, row.daGiaiQuyet, tyLe];
      BcaExcelHelper.styleDataRow(excelRow, idx % 2 === 0, COL_COUNT);
      values.forEach((v, ci) => {
        const cell = excelRow.getCell(ci + 1);
        cell.value = v;
        cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    // Totals row
    const totalsRowIdx = data.data.length + 8;
    const totalsRow = sheet.getRow(totalsRowIdx);
    const grandTotal = data.totals.donThu + data.totals.vuViec + data.totals.vuAn;
    const grandTyLe = grandTotal > 0 ? Math.round((data.totals.daGiaiQuyet / grandTotal) * 100) : 0;
    BcaExcelHelper.styleDataRow(totalsRow, false, COL_COUNT);
    [
      'TỔNG CỘNG',
      data.totals.donThu,
      data.totals.vuViec,
      data.totals.vuAn,
      data.totals.daGiaiQuyet,
      grandTyLe,
    ].forEach((v, ci) => {
      const cell = totalsRow.getCell(ci + 1);
      cell.value = v;
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
    });

    // BCA footer
    BcaExcelHelper.addFooter(sheet, totalsRowIdx + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet, true);

    const filename = `BaoCaoThang_${data.year}${data.month ? '_T' + data.month : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    try { await workbook.xlsx.write(res); } catch (err) { if (!res.headersSent) res.status(500).json({ error: 'Export failed' }); else res.destroy(); }
  }

  // ── Quarterly export ────────────────────────────────────────────────────────

  async exportQuarterly(data: QuarterlyData, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo quý');
    const COL_COUNT = 6;
    const HEADERS = ['Kỳ', 'Đơn thư', 'Vụ việc', 'Vụ án', 'Đã giải quyết', 'Tỷ lệ %'];
    const WIDTHS = [20, 12, 12, 12, 16, 12];

    const title = data.quarter
      ? `BẢNG THỐNG KÊ QUÝ ${data.quarter}/${data.year}`
      : `BẢNG THỐNG KÊ NĂM ${data.year} (THEO QUÝ)`;
    const period = data.quarter
      ? `Kỳ báo cáo: Quý ${data.quarter} năm ${data.year}`
      : `Kỳ báo cáo: Năm ${data.year}`;

    BcaExcelHelper.addHeader(sheet, COL_COUNT, title, period);
    BcaExcelHelper.addColumnHeaders(sheet.getRow(7), HEADERS, WIDTHS);
    sheet.getRow(7).height = 22;

    data.data.forEach((row, idx) => {
      const total = row.donThu + row.vuViec + row.vuAn;
      const tyLe = total > 0 ? Math.round((row.daGiaiQuyet / total) * 100) : 0;
      const excelRow = sheet.getRow(idx + 8);
      BcaExcelHelper.styleDataRow(excelRow, idx % 2 === 0, COL_COUNT);
      [row.quarter, row.donThu, row.vuViec, row.vuAn, row.daGiaiQuyet, tyLe].forEach((v, ci) => {
        const cell = excelRow.getCell(ci + 1);
        cell.value = v;
        cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    const totalsRowIdx = data.data.length + 8;
    const totalsRow = sheet.getRow(totalsRowIdx);
    const grandTotal = data.totals.donThu + data.totals.vuViec + data.totals.vuAn;
    const grandTyLe = grandTotal > 0 ? Math.round((data.totals.daGiaiQuyet / grandTotal) * 100) : 0;
    BcaExcelHelper.styleDataRow(totalsRow, false, COL_COUNT);
    [
      'TỔNG CỘNG',
      data.totals.donThu,
      data.totals.vuViec,
      data.totals.vuAn,
      data.totals.daGiaiQuyet,
      grandTyLe,
    ].forEach((v, ci) => {
      const cell = totalsRow.getCell(ci + 1);
      cell.value = v;
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
    });

    BcaExcelHelper.addFooter(sheet, totalsRowIdx + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet, true);

    const filename = `BaoCaoQuy_${data.year}${data.quarter ? '_Q' + data.quarter : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    try { await workbook.xlsx.write(res); } catch (err) { if (!res.headersSent) res.status(500).json({ error: 'Export failed' }); else res.destroy(); }
  }

  // ── Stat48 export ───────────────────────────────────────────────────────────

  async exportStat48(data: Stat48Data, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    const titleSuffix = data.isDraft ? ' [⚠ DRAFT]' : '';

    data.groups.forEach((group) => {
      // Excel sheet name: max 31 chars, cannot contain * ? : \ / [ ]
      const sheetName = group.name.replace(/[*?:/\\[\]]/g, '-').slice(0, 31);
      const sheet = workbook.addWorksheet(sheetName);

      const COL_COUNT = 5;
      const stat48Title = `THỐNG KÊ 48 TRƯỜNG — ${group.name}${titleSuffix}`;
      const stat48Period = `Từ ngày: ${data.fromDate} — Đến ngày: ${data.toDate}${data.unit ? ` | Đơn vị: ${data.unit}` : ''} | Tổng: ${data.totalCases} | Thiếu: ${data.nullRatePct}%`;
      BcaExcelHelper.addHeader(sheet, COL_COUNT, stat48Title, stat48Period);

      // Row 7: column headers
      BcaExcelHelper.addColumnHeaders(sheet.getRow(7), [
        'Tên trường', 'Loại', 'Tổng/Giá trị', 'Số lượng/Tần suất', 'Thiếu dữ liệu',
      ], [28, 14, 22, 18, 16]);
      sheet.getRow(7).height = 22;

      let rowIdx = 8;

      group.fields.forEach((field) => {
        if (field.type === 'numeric') {
          const row = sheet.getRow(rowIdx++);
          [
            field.field,
            'Số',
            field.total ?? 0,
            field.dataCount,
            field.nullCount,
          ].forEach((v, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = v;
            borderCell(cell);
            cell.alignment = { vertical: 'middle', horizontal: ci < 2 ? 'left' : 'center' };
          });
        } else {
          // categorical: one row per distribution entry
          const dist = field.distribution ?? {};
          const entries = Object.entries(dist);
          if (entries.length === 0) {
            const row = sheet.getRow(rowIdx++);
            [field.field, 'Phân loại', '(không có dữ liệu)', 0, field.nullCount].forEach(
              (v, ci) => {
                const cell = row.getCell(ci + 1);
                cell.value = v;
                borderCell(cell);
                cell.alignment = { vertical: 'middle', horizontal: ci < 2 ? 'left' : 'center' };
              },
            );
          } else {
            entries.forEach(([value, count], entryIdx) => {
              const row = sheet.getRow(rowIdx++);
              [
                entryIdx === 0 ? field.field : '',
                entryIdx === 0 ? 'Phân loại' : '',
                value,
                count,
                entryIdx === 0 ? field.nullCount : '',
              ].forEach((v, ci) => {
                const cell = row.getCell(ci + 1);
                cell.value = v;
                borderCell(cell);
                cell.alignment = { vertical: 'middle', horizontal: ci < 2 ? 'left' : 'center', wrapText: true };
              });
            });
          }
        }
      });
      BcaExcelHelper.addFooter(sheet, rowIdx + 1, COL_COUNT);
      BcaExcelHelper.setPrintSetup(sheet, true);
    });

    const filename = `Stat48_${data.fromDate}_${data.toDate}${data.isDraft ? '_DRAFT' : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    try { await workbook.xlsx.write(res); } catch (err) { if (!res.headersSent) res.status(500).json({ error: "Export failed" }); else res.destroy(); }
  }
}
