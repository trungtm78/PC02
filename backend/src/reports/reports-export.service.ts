import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

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

    // Row 1: title
    sheet.mergeCells('A1:F1');
    applyNavyHeader(sheet.getCell('A1'), 'PHÒNG CẢNH SÁT HÌNH SỰ — PC02');
    sheet.getRow(1).height = 30;

    // Row 2: subtitle
    const label = data.month
      ? `BẢNG THỐNG KÊ THÁNG ${data.month}/${data.year}`
      : `BẢNG THỐNG KÊ NĂM ${data.year}`;
    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = label;
    subtitleCell.font = { bold: true, size: 12 };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    // Row 3: column headers
    applyColumnHeaders(sheet.getRow(3), [
      'Đơn vị', 'Đơn thư', 'Vụ việc', 'Vụ án', 'Đã giải quyết', 'Tỷ lệ %',
    ]);

    // Set column widths
    sheet.columns = [
      { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 12 },
    ];

    // Data rows
    data.data.forEach((row, idx) => {
      const total = row.donThu + row.vuViec + row.vuAn;
      const tyLe = total > 0 ? Math.round((row.daGiaiQuyet / total) * 100) : 0;
      const excelRow = sheet.getRow(idx + 4);
      const values = [row.month, row.donThu, row.vuViec, row.vuAn, row.daGiaiQuyet, tyLe];
      values.forEach((v, ci) => {
        const cell = excelRow.getCell(ci + 1);
        cell.value = v;
        borderCell(cell);
        cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    // Totals row
    const totalsRowIdx = data.data.length + 4;
    const totalsRow = sheet.getRow(totalsRowIdx);
    const grandTotal = data.totals.donThu + data.totals.vuViec + data.totals.vuAn;
    const grandTyLe = grandTotal > 0 ? Math.round((data.totals.daGiaiQuyet / grandTotal) * 100) : 0;
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
      cell.font = { bold: true };
      borderCell(cell);
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
    });

    // Footer
    const footerRowIdx = totalsRowIdx + 2;
    sheet.mergeCells(`A${footerRowIdx}:F${footerRowIdx}`);
    sheet.getCell(`A${footerRowIdx}`).value =
      'Hồ Chí Minh, ngày ___ tháng ___ năm ___';
    sheet.getCell(`A${footerRowIdx}`).alignment = { horizontal: 'right' };

    const sigRowIdx = footerRowIdx + 1;
    sheet.getCell(`A${sigRowIdx}`).value = 'CÁN BỘ THỐNG KÊ';
    sheet.getCell(`E${sigRowIdx}`).value = 'LÃNH ĐẠO';
    sheet.getCell(`A${sigRowIdx}`).font = { bold: true };
    sheet.getCell(`E${sigRowIdx}`).font = { bold: true };

    const filename = `BaoCaoThang_${data.year}${data.month ? '_T' + data.month : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    await workbook.xlsx.write(res);
  }

  // ── Quarterly export ────────────────────────────────────────────────────────

  async exportQuarterly(data: QuarterlyData, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo quý');

    // Row 1
    sheet.mergeCells('A1:F1');
    applyNavyHeader(sheet.getCell('A1'), 'PHÒNG CẢNH SÁT HÌNH SỰ — PC02');
    sheet.getRow(1).height = 30;

    // Row 2
    const label = data.quarter
      ? `BẢNG THỐNG KÊ QUÝ ${data.quarter}/${data.year}`
      : `BẢNG THỐNG KÊ NĂM ${data.year} (THEO QUÝ)`;
    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = label;
    subtitleCell.font = { bold: true, size: 12 };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    // Row 3: headers
    applyColumnHeaders(sheet.getRow(3), [
      'Kỳ', 'Đơn thư', 'Vụ việc', 'Vụ án', 'Đã giải quyết', 'Tỷ lệ %',
    ]);

    sheet.columns = [
      { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 12 },
    ];

    data.data.forEach((row, idx) => {
      const total = row.donThu + row.vuViec + row.vuAn;
      const tyLe = total > 0 ? Math.round((row.daGiaiQuyet / total) * 100) : 0;
      const excelRow = sheet.getRow(idx + 4);
      [row.quarter, row.donThu, row.vuViec, row.vuAn, row.daGiaiQuyet, tyLe].forEach((v, ci) => {
        const cell = excelRow.getCell(ci + 1);
        cell.value = v;
        borderCell(cell);
        cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    const totalsRowIdx = data.data.length + 4;
    const totalsRow = sheet.getRow(totalsRowIdx);
    const grandTotal = data.totals.donThu + data.totals.vuViec + data.totals.vuAn;
    const grandTyLe = grandTotal > 0 ? Math.round((data.totals.daGiaiQuyet / grandTotal) * 100) : 0;
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
      cell.font = { bold: true };
      borderCell(cell);
      cell.alignment = { horizontal: ci === 0 ? 'left' : 'center', vertical: 'middle' };
    });

    const footerRowIdx = totalsRowIdx + 2;
    sheet.mergeCells(`A${footerRowIdx}:F${footerRowIdx}`);
    sheet.getCell(`A${footerRowIdx}`).value = 'Hồ Chí Minh, ngày ___ tháng ___ năm ___';
    sheet.getCell(`A${footerRowIdx}`).alignment = { horizontal: 'right' };
    const sigRowIdx = footerRowIdx + 1;
    sheet.getCell(`A${sigRowIdx}`).value = 'CÁN BỘ THỐNG KÊ';
    sheet.getCell(`E${sigRowIdx}`).value = 'LÃNH ĐẠO';
    sheet.getCell(`A${sigRowIdx}`).font = { bold: true };
    sheet.getCell(`E${sigRowIdx}`).font = { bold: true };

    const filename = `BaoCaoQuy_${data.year}${data.quarter ? '_Q' + data.quarter : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    await workbook.xlsx.write(res);
  }

  // ── Stat48 export ───────────────────────────────────────────────────────────

  async exportStat48(data: Stat48Data, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();

    const titleSuffix = data.isDraft ? ' [⚠ DRAFT]' : '';

    data.groups.forEach((group) => {
      const sheet = workbook.addWorksheet(group.name.slice(0, 31)); // Excel sheet name max 31 chars

      // Row 1: group name
      sheet.mergeCells('A1:E1');
      applyNavyHeader(
        sheet.getCell('A1'),
        `${group.name}${titleSuffix} — Tổng vụ việc: ${data.totalCases} | Thiếu dữ liệu: ${data.nullRatePct}%`,
      );
      sheet.getRow(1).height = 28;

      // Row 2: column headers
      applyColumnHeaders(sheet.getRow(2), [
        'Tên trường', 'Loại', 'Tổng/Giá trị', 'Số lượng/Tần suất', 'Thiếu dữ liệu',
      ]);

      sheet.columns = [
        { width: 28 }, { width: 14 }, { width: 22 }, { width: 18 }, { width: 16 },
      ];

      let rowIdx = 3;

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
    });

    const filename = `Stat48_${data.fromDate}_${data.toDate}${data.isDraft ? '_DRAFT' : ''}_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);
    await workbook.xlsx.write(res);
  }
}
