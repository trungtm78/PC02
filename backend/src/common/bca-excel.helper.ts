import * as ExcelJS from 'exceljs';

/**
 * BcaExcelHelper — reusable BCA-branded Excel helpers.
 *
 * Centralises all navy/white header, footer, print-setup and row-styling
 * logic so every export sheet looks identical.
 */
export class BcaExcelHelper {
  static readonly NAVY = 'FF1B2B4E';
  static readonly LIGHT_BLUE = 'FFEFF6FF';
  static readonly WHITE = 'FFFFFFFF';

  // ─────────────────────────────────────────────────────────────────────
  // addHeader — 6-row BCA letterhead block
  // ─────────────────────────────────────────────────────────────────────
  static addHeader(
    sheet: ExcelJS.Worksheet,
    colCount: number,
    title: string,
    period: string,
  ): void {
    const lastCol = BcaExcelHelper._colLetter(colCount);

    // Row 1: "CÔNG AN THÀNH PHỐ HỒ CHÍ MINH"
    sheet.mergeCells(`A1:${lastCol}1`);
    const r1 = sheet.getCell('A1');
    r1.value = 'CÔNG AN THÀNH PHỐ HỒ CHÍ MINH';
    r1.font = { size: 11, name: 'Times New Roman' };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 18;

    // Row 2: "PHÒNG CẢNH SÁT HÌNH SỰ - PC02"
    sheet.mergeCells(`A2:${lastCol}2`);
    const r2 = sheet.getCell('A2');
    r2.value = 'PHÒNG CẢNH SÁT HÌNH SỰ - PC02';
    r2.font = { bold: true, size: 12, name: 'Times New Roman' };
    r2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Row 3: blank spacer
    sheet.getRow(3).height = 8;

    // Row 4: title
    sheet.mergeCells(`A4:${lastCol}4`);
    const r4 = sheet.getCell('A4');
    r4.value = title.toUpperCase();
    r4.font = {
      bold: true,
      size: 14,
      color: { argb: BcaExcelHelper.NAVY },
      name: 'Times New Roman',
    };
    r4.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 26;

    // Row 5: period (italic)
    sheet.mergeCells(`A5:${lastCol}5`);
    const r5 = sheet.getCell('A5');
    r5.value = period;
    r5.font = { italic: true, size: 11, name: 'Times New Roman' };
    r5.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(5).height = 18;

    // Row 6: blank spacer
    sheet.getRow(6).height = 6;
  }

  // ─────────────────────────────────────────────────────────────────────
  // addColumnHeaders — navy-background header row
  // ─────────────────────────────────────────────────────────────────────
  static addColumnHeaders(
    row: ExcelJS.Row,
    headers: string[],
    widths?: number[],
  ): void {
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      cell.value = h;
      cell.font = {
        bold: true,
        color: { argb: BcaExcelHelper.WHITE },
        size: 11,
        name: 'Times New Roman',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BcaExcelHelper.NAVY },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Set column width if provided
      if (widths && widths[i] != null && row.worksheet) {
        const col = row.worksheet.getColumn(i + 1);
        if (col) col.width = widths[i];
      }
    });
    row.height = 28;
  }

  // ─────────────────────────────────────────────────────────────────────
  // addFooter — signature block at bottom of sheet
  // ─────────────────────────────────────────────────────────────────────
  static addFooter(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    colCount: number,
  ): void {
    const lastCol = BcaExcelHelper._colLetter(colCount);
    const midCol = BcaExcelHelper._colLetter(Math.max(1, Math.floor(colCount / 2)));
    const rightStart = BcaExcelHelper._colLetter(Math.max(1, colCount - 1));

    // Row startRow: date line right-aligned
    sheet.mergeCells(`A${startRow}:${lastCol}${startRow}`);
    const dateCell = sheet.getCell(`A${startRow}`);
    dateCell.value = 'Hồ Chí Minh, ngày ___ tháng ___ năm ___';
    dateCell.font = { italic: true, size: 11, name: 'Times New Roman' };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(startRow).height = 18;

    // Row startRow+1: two sig titles
    const sigTitleRow = startRow + 1;
    sheet.mergeCells(`A${sigTitleRow}:${midCol}${sigTitleRow}`);
    const leftTitle = sheet.getCell(`A${sigTitleRow}`);
    leftTitle.value = 'NGƯỜI LẬP BẢNG';
    leftTitle.font = { bold: true, size: 11, name: 'Times New Roman' };
    leftTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${rightStart}${sigTitleRow}:${lastCol}${sigTitleRow}`);
    const rightTitle = sheet.getCell(`${rightStart}${sigTitleRow}`);
    rightTitle.value = 'THỦ TRƯỞNG ĐƠN VỊ';
    rightTitle.font = { bold: true, size: 11, name: 'Times New Roman' };
    rightTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(sigTitleRow).height = 18;

    // Row startRow+2: "(Ký, ghi rõ họ tên)" on both sides
    const sigHintRow = startRow + 2;
    sheet.mergeCells(`A${sigHintRow}:${midCol}${sigHintRow}`);
    const leftHint = sheet.getCell(`A${sigHintRow}`);
    leftHint.value = '(Ký, ghi rõ họ tên)';
    leftHint.font = { italic: true, size: 10, name: 'Times New Roman' };
    leftHint.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${rightStart}${sigHintRow}:${lastCol}${sigHintRow}`);
    const rightHint = sheet.getCell(`${rightStart}${sigHintRow}`);
    rightHint.value = '(Ký, ghi rõ họ tên)';
    rightHint.font = { italic: true, size: 10, name: 'Times New Roman' };
    rightHint.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(sigHintRow).height = 16;

    // Rows startRow+3/4: blank space for physical signature
    sheet.getRow(startRow + 3).height = 18;
    sheet.getRow(startRow + 4).height = 18;

    // Row startRow+5: name lines
    const nameRow = startRow + 5;
    sheet.mergeCells(`A${nameRow}:${midCol}${nameRow}`);
    const leftName = sheet.getCell(`A${nameRow}`);
    leftName.font = { bold: true, size: 11, name: 'Times New Roman' };
    leftName.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${rightStart}${nameRow}:${lastCol}${nameRow}`);
    const rightName = sheet.getCell(`${rightStart}${nameRow}`);
    rightName.font = { bold: true, size: 11, name: 'Times New Roman' };
    rightName.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(nameRow).height = 18;
  }

  // ─────────────────────────────────────────────────────────────────────
  // styleDataRow — alternating row background + borders
  // ─────────────────────────────────────────────────────────────────────
  static styleDataRow(
    row: ExcelJS.Row,
    isEven: boolean,
    colCount: number,
  ): void {
    const fillColor = isEven ? BcaExcelHelper.LIGHT_BLUE : BcaExcelHelper.WHITE;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = {
        ...(cell.alignment ?? {}),
        vertical: 'middle',
      };
      cell.font = {
        ...(cell.font ?? {}),
        size: 11,
        name: 'Times New Roman',
      };
    }
    row.height = 20;
  }

  // ─────────────────────────────────────────────────────────────────────
  // setPrintSetup — A4 landscape, fit to 1 page wide
  // ─────────────────────────────────────────────────────────────────────
  static setPrintSetup(
    sheet: ExcelJS.Worksheet,
    landscape = true,
  ): void {
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.39,  // ~1 cm
        right: 0.39,
        top: 0.39,
        bottom: 0.39,
        header: 0.2,
        footer: 0.2,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // border — apply thin border to all four sides of a cell
  // ─────────────────────────────────────────────────────────────────────
  static border(cell: ExcelJS.Cell): void {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helper: convert column number to Excel letter (1→A, 26→Z, 27→AA …)
  // ─────────────────────────────────────────────────────────────────────
  private static _colLetter(n: number): string {
    let result = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  }
}
