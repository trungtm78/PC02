/**
 * v0.47 PR4 T16 — one-off script tạo 6 xlsx Phụ lục templates.
 * Mỗi file 1 sheet duy nhất với header rows (CỘNG HÒA + đơn vị + STT/cột),
 * data rows trống (PhuLucReportService streaming append rows at runtime).
 *
 * Output: backend/templates/xlsx/PHU_LUC_0{1..6}.xlsx
 *
 * Run: cd backend && node_modules/.bin/ts-node --transpile-only scripts/generate-xlsx-templates.ts
 *
 * Schema khớp với 15 file mẫu PC01 (CS1/CS2/DOI3-6/KV1-10) tại
 * C:\PC02\docs\requiements\FILE GUI PC01\. Per-sheet column structure:
 *
 *   PL-01 DS hồ sơ Vụ việc hiện hành (trừ TĐC)
 *   PL-02 DS Vụ việc TĐC còn thời hiệu
 *   PL-03 DS Vụ việc TĐC hết thời hiệu
 *   PL-04 DS hồ sơ Vụ án hiện hành (trừ TĐC)
 *   PL-05 DS Vụ án TĐC còn thời hiệu
 *   PL-06 DS Vụ án TĐC hết thời hiệu
 */

import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface PhuLucSpec {
  filename: string;
  reportCode: string;     // PHU_LUC_01..PHU_LUC_06
  title: string;
  subtitle: string;       // dùng cho header row 3
  /** Tên cột (header). Row đầu tiên với colspan title, row 2 trống, row 3 phụ đề, row 4 onwards là column header (vẫn 1 row đơn giản). */
  columns: { header: string; key: string; width: number }[];
}

const COMMON_COLUMNS_VU_VIEC: PhuLucSpec['columns'] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Số đăng ký hồ sơ + ngày đăng ký', key: 'soDangKy', width: 24 },
  { header: 'Tóm tắt nội dung vụ việc', key: 'tomTat', width: 36 },
  { header: 'Tội danh / Loại đơn', key: 'toiDanh', width: 18 },
  { header: 'Họ tên người tố giác / nghi vấn', key: 'hoTen', width: 22 },
  { header: 'Năm sinh', key: 'namSinh', width: 10 },
  { header: 'Địa chỉ', key: 'diaChi', width: 30 },
  { header: 'Đồ vật, tài liệu kèm theo', key: 'doVat', width: 26 },
  { header: 'Ngày tiếp nhận', key: 'ngayTiepNhan', width: 14 },
  { header: 'Hạn xử lý', key: 'hanXuLy', width: 14 },
  { header: 'Trạng thái', key: 'status', width: 16 },
  { header: 'Đơn vị thụ lý', key: 'donVi', width: 18 },
  { header: 'Điều tra viên', key: 'dieuTraVien', width: 20 },
  { header: 'Ghi chú', key: 'ghiChu', width: 24 },
];

const COMMON_COLUMNS_VU_AN: PhuLucSpec['columns'] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'Mã hồ sơ vụ án', key: 'caseCode', width: 18 },
  { header: 'Tên vụ án / Tóm tắt nội dung', key: 'name', width: 36 },
  { header: 'Tội danh', key: 'toiDanh', width: 22 },
  { header: 'Họ tên bị can', key: 'biCan', width: 22 },
  { header: 'Năm sinh', key: 'namSinh', width: 10 },
  { header: 'Địa chỉ thường trú', key: 'diaChi', width: 30 },
  { header: 'Vật chứng/tài liệu (số/ngày)', key: 'vatChung', width: 26 },
  { header: 'Ngày khởi tố vụ án', key: 'ngayKhoiTo', width: 14 },
  { header: 'Trạng thái', key: 'status', width: 16 },
  { header: 'Đơn vị thụ lý', key: 'donVi', width: 18 },
  { header: 'Điều tra viên', key: 'dieuTraVien', width: 20 },
  { header: 'Ghi chú', key: 'ghiChu', width: 24 },
];

const COMMON_COLUMNS_TDC_VU_VIEC: PhuLucSpec['columns'] = [
  ...COMMON_COLUMNS_VU_VIEC.slice(0, -1),
  { header: 'Căn cứ tạm đình chỉ', key: 'canCuTDC', width: 22 },
  { header: 'Số/ngày QĐ tạm đình chỉ', key: 'soQDTDC', width: 22 },
  { header: 'Ngày hết thời hiệu truy cứu TNHS', key: 'ngayHetThoiHieu', width: 22 },
  { header: 'BB trao đổi với VKS, KH khắc phục (số/ngày)', key: 'tdcKhacPhucBienBan', width: 28 },
  { header: 'Biện pháp, tiến độ khắc phục lý do TĐC', key: 'tdcKhacPhucLyDoBienPhap', width: 32 },
  { header: 'Ghi chú', key: 'ghiChu', width: 24 },
];

const COMMON_COLUMNS_TDC_VU_AN: PhuLucSpec['columns'] = [
  ...COMMON_COLUMNS_VU_AN.slice(0, -1),
  { header: 'Căn cứ tạm đình chỉ', key: 'canCuTDC', width: 22 },
  { header: 'Số/ngày QĐ tạm đình chỉ', key: 'soQDTDC', width: 22 },
  { header: 'Ngày hết thời hiệu truy cứu TNHS', key: 'ngayHetThoiHieu', width: 22 },
  { header: 'BB trao đổi với VKS, KH khắc phục (số/ngày)', key: 'tdcKhacPhucBienBan', width: 28 },
  { header: 'Biện pháp, tiến độ khắc phục lý do TĐC', key: 'tdcKhacPhucLyDoBienPhap', width: 32 },
  { header: 'Ghi chú', key: 'ghiChu', width: 24 },
];

const ALL_SPECS: PhuLucSpec[] = [
  {
    filename: 'PHU_LUC_01.xlsx',
    reportCode: 'PHU_LUC_01',
    title: 'PHỤ LỤC 01',
    subtitle: 'DANH SÁCH HỒ SƠ VỤ VIỆC HIỆN HÀNH (TRỪ TẠM ĐÌNH CHỈ)',
    columns: COMMON_COLUMNS_VU_VIEC,
  },
  {
    filename: 'PHU_LUC_02.xlsx',
    reportCode: 'PHU_LUC_02',
    title: 'PHỤ LỤC 02',
    subtitle: 'DANH SÁCH VỤ VIỆC TẠM ĐÌNH CHỈ CÒN THỜI HIỆU',
    columns: COMMON_COLUMNS_TDC_VU_VIEC,
  },
  {
    filename: 'PHU_LUC_03.xlsx',
    reportCode: 'PHU_LUC_03',
    title: 'PHỤ LỤC 03',
    subtitle: 'DANH SÁCH VỤ VIỆC TẠM ĐÌNH CHỈ HẾT THỜI HIỆU',
    columns: COMMON_COLUMNS_TDC_VU_VIEC,
  },
  {
    filename: 'PHU_LUC_04.xlsx',
    reportCode: 'PHU_LUC_04',
    title: 'PHỤ LỤC 04',
    subtitle: 'DANH SÁCH HỒ SƠ VỤ ÁN HIỆN HÀNH (TRỪ TẠM ĐÌNH CHỈ)',
    columns: COMMON_COLUMNS_VU_AN,
  },
  {
    filename: 'PHU_LUC_05.xlsx',
    reportCode: 'PHU_LUC_05',
    title: 'PHỤ LỤC 05',
    subtitle: 'DANH SÁCH VỤ ÁN TẠM ĐÌNH CHỈ CÒN THỜI HIỆU',
    columns: COMMON_COLUMNS_TDC_VU_AN,
  },
  {
    filename: 'PHU_LUC_06.xlsx',
    reportCode: 'PHU_LUC_06',
    title: 'PHỤ LỤC 06',
    subtitle: 'DANH SÁCH VỤ ÁN TẠM ĐÌNH CHỈ HẾT THỜI HIỆU',
    columns: COMMON_COLUMNS_TDC_VU_AN,
  },
];

async function buildTemplate(spec: PhuLucSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PC02 v0.47 generator';
  wb.created = new Date();

  const ws = wb.addWorksheet('DS', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true },
  });

  // Configure columns (header + width)
  ws.columns = spec.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Insert title rows ABOVE the header row that columns config produced.
  ws.spliceRows(1, 0, [], [], [], []);
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = 'CÔNG AN THÀNH PHỐ HỒ CHÍ MINH';
  titleRow.getCell(1).font = { bold: true, size: 12 };
  titleRow.height = 18;
  ws.mergeCells(1, 1, 1, spec.columns.length);
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  const orgRow = ws.getRow(2);
  orgRow.getCell(1).value = 'PHÒNG CẢNH SÁT HÌNH SỰ (PC02)';
  orgRow.getCell(1).font = { bold: true };
  ws.mergeCells(2, 1, 2, spec.columns.length);
  orgRow.getCell(1).alignment = { horizontal: 'center' };

  const titleRowMain = ws.getRow(3);
  titleRowMain.getCell(1).value = spec.title;
  titleRowMain.getCell(1).font = { bold: true, size: 14 };
  ws.mergeCells(3, 1, 3, spec.columns.length);
  titleRowMain.getCell(1).alignment = { horizontal: 'center' };

  const subtitleRow = ws.getRow(4);
  subtitleRow.getCell(1).value = spec.subtitle;
  subtitleRow.getCell(1).font = { bold: true };
  ws.mergeCells(4, 1, 4, spec.columns.length);
  subtitleRow.getCell(1).alignment = { horizontal: 'center', wrapText: true };
  subtitleRow.height = 24;

  // Style the column-header row (row 5 after splice).
  const headerRow = ws.getRow(5);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 36;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F0FA' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function main() {
  const outDir = path.resolve(__dirname, '..', 'templates', 'xlsx');
  fs.mkdirSync(outDir, { recursive: true });

  for (const spec of ALL_SPECS) {
    const buf = await buildTemplate(spec);
    const outPath = path.join(outDir, spec.filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  ✔ Wrote ${spec.filename} (${buf.length} bytes)`);
  }

  console.log(`\nDone. ${ALL_SPECS.length} xlsx templates in ${outDir}`);
}

main().catch((e) => {
  console.error('generate-xlsx-templates failed:', e);
  process.exit(1);
});
