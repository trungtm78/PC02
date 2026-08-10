import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { BcaExcelHelper } from '../../common/bca-excel.helper';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions for each Phụ lục type
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_BASE_HEADERS = [
  'STT',
  'Mã VV',
  'Tên vụ việc',
  'Đối tượng',
  'Địa điểm',
  'Loại',
  'Ngày tiếp nhận',
  'Tình trạng',
  'Ghi chú',
];
const INCIDENT_BASE_WIDTHS = [6, 14, 30, 22, 22, 14, 16, 18, 20];

const TDC_EXTRA_HEADERS = [
  'Căn cứ TĐC',
  'Số QĐ TĐC',
  'Ngày TĐC',
  'Hạn thời hiệu',
  'Biện pháp khắc phục',
  'Tiến độ',
  'Kết quả',
  'Ghi chú',
];
const TDC_EXTRA_WIDTHS = [22, 14, 14, 14, 22, 18, 18, 20];

const INCIDENT_TDC_HEADERS = [...INCIDENT_BASE_HEADERS, ...TDC_EXTRA_HEADERS];
const INCIDENT_TDC_WIDTHS = [...INCIDENT_BASE_WIDTHS, ...TDC_EXTRA_WIDTHS];

const CASE_BASE_HEADERS = [
  'STT',
  'Mã VA',
  'Tên vụ án',
  'Họ tên bị can',
  'Năm sinh',
  'Địa chỉ',
  'Tội danh',
  'Phân loại',
  'Ngày tiếp nhận',
  'Tình trạng',
  'Ghi chú',
];
const CASE_BASE_WIDTHS = [6, 12, 30, 22, 10, 22, 18, 14, 16, 18, 20];

const CASE_TDC_HEADERS = [...CASE_BASE_HEADERS, ...TDC_EXTRA_HEADERS];
const CASE_TDC_WIDTHS = [...CASE_BASE_WIDTHS, ...TDC_EXTRA_WIDTHS];

// ─────────────────────────────────────────────────────────────────────────────
// Tab names
// ─────────────────────────────────────────────────────────────────────────────

const TAB_NAMES: Record<number, string> = {
  1: 'PL1 — Vụ việc đang giải quyết',
  2: 'PL2 — TĐC hết thời hiệu',
  3: 'PL3 — TĐC còn thời hiệu',
  4: 'PL4 — Vụ án đang điều tra',
  5: 'PL5 — VA-TĐC hết thời hiệu',
  6: 'PL6 — VA-TĐC còn thời hiệu',
};

const TITLES: Record<number, string> = {
  1: 'DANH SÁCH VỤ VIỆC ĐANG GIẢI QUYẾT',
  2: 'DANH SÁCH VỤ VIỆC TĐC HẾT THỜI HIỆU',
  3: 'DANH SÁCH VỤ VIỆC TĐC CÒN THỜI HIỆU',
  4: 'DANH SÁCH VỤ ÁN ĐANG ĐIỀU TRA',
  5: 'DANH SÁCH VỤ ÁN TĐC HẾT THỜI HIỆU',
  6: 'DANH SÁCH VỤ ÁN TĐC CÒN THỜI HIỆU',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtYear(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return String(dt.getFullYear());
}

function caseCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function setXlsxHeaders(res: Response, filename: string): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PhuLuc16ExportService {
  async export(loai: number, data: any[], res: Response): Promise<void> {
    const filename = `PhuLuc${loai}_PC02_${Date.now()}.xlsx`;
    setXlsxHeaders(res, filename);

    // Use streaming writer to support large datasets
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });

    const tabName = TAB_NAMES[loai] ?? `PL${loai}`;
    const title = TITLES[loai] ?? `PHỤ LỤC ${loai}`;
    const period = `(Xuất ngày ${fmtDate(new Date())})`;

    const sheet = workbook.addWorksheet(tabName);

    try {
      if (loai === 1) {
        await this._writeIncidents(sheet, data, title, period, false);
      } else if (loai === 2 || loai === 3) {
        await this._writeIncidents(sheet, data, title, period, true);
      } else if (loai === 4) {
        await this._writeCases(sheet, data, title, period, false);
      } else {
        // loai 5 or 6
        await this._writeCases(sheet, data, title, period, true);
      }

      await workbook.commit();
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Export failed' });
      } else {
        res.destroy();
      }
    }
  }

  // ── Incidents sheet (PL1, PL2, PL3) ────────────────────────────────────────

  private async _writeIncidents(
    sheet: any,
    data: any[],
    title: string,
    period: string,
    isTdc: boolean,
  ): Promise<void> {
    const headers = isTdc ? INCIDENT_TDC_HEADERS : INCIDENT_BASE_HEADERS;
    const widths = isTdc ? INCIDENT_TDC_WIDTHS : INCIDENT_BASE_WIDTHS;
    const colCount = headers.length;

    // BCA header block (rows 1-6)
    BcaExcelHelper.addHeader(
      sheet as unknown as ExcelJS.Worksheet,
      colCount,
      title,
      period,
    );
    BcaExcelHelper.setPrintSetup(sheet as unknown as ExcelJS.Worksheet);

    // Column header row (row 7)
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, headers, widths);
    await headerRow.commit?.();

    // Data rows starting at row 8
    let rowIdx = 8;
    let stt = 1;

    for (const incident of data) {
      const row = sheet.getRow(rowIdx);

      const baseValues = [
        stt++,
        incident.code ?? incident.id?.slice(0, 8).toUpperCase() ?? '',
        incident.name ?? '',
        incident.doiTuongCaNhan ?? '',
        incident.diaChiXayRa ?? '',
        incident.incidentType ?? incident.loaiDonVu ?? '',
        fmtDate(incident.createdAt),
        incident.status ?? '',
        '',
      ];

      const tdcValues = isTdc
        ? [
            incident.lyDoTamDinhChiText ?? incident.lyDoTamDinhChiVuViec ?? '',
            incident.soQuyetDinhTamDinhChiVV ?? '',
            fmtDate(incident.ngayTamDinhChiVV),
            fmtDate(incident.ngayHetThoiHieuVV ?? incident.deadline),
            '',
            '',
            incident.ketQuaXuLy ?? '',
            '',
          ]
        : [];

      const allValues = [...baseValues, ...tdcValues];

      allValues.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        // v0.47 PR4 — CSV/Excel injection defense. User-supplied strings (sender
        // names, addresses, free-text notes) get '-prefixed if they start with
        // =, +, -, @, \t, \r so Excel renders the literal instead of evaluating.
        cell.value = escapeXlsxCell(v);
        cell.alignment = {
          vertical: 'middle',
          horizontal: ci === 0 ? 'center' : 'left',
          wrapText: true,
        };
      });

      BcaExcelHelper.styleDataRow(
        row as unknown as ExcelJS.Row,
        rowIdx % 2 === 0,
        colCount,
      );

      await row.commit?.();
      rowIdx++;
    }

    // Footer
    const footerStart = rowIdx + 1;
    BcaExcelHelper.addFooter(
      sheet as unknown as ExcelJS.Worksheet,
      footerStart,
      colCount,
    );

    await sheet.commit?.();
  }

  // ── Cases sheet (PL4, PL5, PL6) ────────────────────────────────────────────
  // PL4-6 expand multi-subject cases to one row per subject (SUSPECT type).

  private async _writeCases(
    sheet: any,
    data: any[],
    title: string,
    period: string,
    isTdc: boolean,
  ): Promise<void> {
    const headers = isTdc ? CASE_TDC_HEADERS : CASE_BASE_HEADERS;
    const widths = isTdc ? CASE_TDC_WIDTHS : CASE_BASE_WIDTHS;
    const colCount = headers.length;

    // BCA header block (rows 1-6)
    BcaExcelHelper.addHeader(
      sheet as unknown as ExcelJS.Worksheet,
      colCount,
      title,
      period,
    );
    BcaExcelHelper.setPrintSetup(sheet as unknown as ExcelJS.Worksheet);

    // Column header row (row 7)
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, headers, widths);
    await headerRow.commit?.();

    // Data rows starting at row 8
    let rowIdx = 8;
    let stt = 1;

    for (const c of data) {
      const subjects: any[] =
        c.subjects && c.subjects.length > 0 ? c.subjects : [null];

      for (let si = 0; si < subjects.length; si++) {
        const subj = subjects[si];
        const row = sheet.getRow(rowIdx);

        const baseValues = [
          si === 0 ? stt : '', // STT only on first subject row
          caseCode(c.id),
          c.name ?? '',
          subj ? (subj.fullName ?? '') : '',
          subj ? fmtYear(subj.dateOfBirth) : '',
          subj ? (subj.address ?? '') : '',
          subj ? (subj.crimeId ?? '') : (c.crime ?? ''),
          c.capDoToiPham ?? '',
          fmtDate(c.createdAt),
          c.status ?? '',
          '',
        ];

        const tdcValues = isTdc
          ? [
              c.lyDoTamDinhChiText ?? c.lyDoTamDinhChiVuAn ?? '',
              c.soQuyetDinhTamDinhChi ?? '',
              fmtDate(c.ngayTamDinhChi),
              fmtDate(c.ngayHetThoiHieu ?? c.deadline),
              '',
              '',
              '',
              '',
            ]
          : [];

        const allValues = [...baseValues, ...tdcValues];

        allValues.forEach((v, ci) => {
          const cell = row.getCell(ci + 1);
          // v0.47 PR4 — CSV/Excel injection defense (same hardening as _writeIncidents).
          cell.value = escapeXlsxCell(v);
          cell.alignment = {
            vertical: 'middle',
            horizontal: ci === 0 ? 'center' : 'left',
            wrapText: true,
          };
        });

        BcaExcelHelper.styleDataRow(
          row as unknown as ExcelJS.Row,
          rowIdx % 2 === 0,
          colCount,
        );

        await row.commit?.();
        rowIdx++;
      }

      stt++;
    }

    // Footer
    const footerStart = rowIdx + 1;
    BcaExcelHelper.addFooter(
      sheet as unknown as ExcelJS.Worksheet,
      footerStart,
      colCount,
    );

    await sheet.commit?.();
  }
}
