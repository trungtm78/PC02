import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { BcaExcelHelper } from '../bca-excel.helper';

/** Trần dòng một lần xuất. Vượt trần thì 400 nói rõ, không cắt lặng lẽ. */
export const TRAN_XUAT_DANH_SACH = 50_000;
/** Số dòng đọc mỗi lượt — đủ lớn để ít lượt, đủ nhỏ để không giữ cả bảng trong bộ nhớ. */
const LO_MAC_DINH = 1_000;
/** Hàng tiêu đề cột trong mẫu BCA (`BcaExcelHelper.addHeader` chiếm hàng 1–6). */
const HANG_TIEU_DE_COT = 7;
// Reserve two rows for the standard footer after the final data row.
const TRAN_DONG_SHEET_EXCEL = 1_048_576 - HANG_TIEU_DE_COT - 2;

/**
 * Một cột xuất. `key` TRÙNG khoá cột trên bảng giao diện, để "xuất các cột đang hiện" nói đúng một
 * thứ ở cả hai phía (cổng kiểm khoá hai phía khớp nhau).
 */
export interface KhaiCotXuat<T> {
  key: string;
  tieuDe: string;
  rong: number;
  doc: (dong: T) => string | number | null;
}

export interface SheetLienQuan<T> {
  ten: string;
  cot: readonly KhaiCotXuat<Record<string, unknown>>[];
  layDong: (hoSo: T) => readonly Record<string, unknown>[] | null | undefined;
  /** Count with the same scope as layDong, before any response bytes are sent. */
  demDong: (ids: string[]) => Promise<number>;
}

/** Cột theo thứ tự người dùng đang xem; không chọn thì mọi cột khai. Cột lạ → 400. */
export function chonCotXuat<T>(
  khai: readonly KhaiCotXuat<T>[],
  cot: readonly string[] | undefined,
): KhaiCotXuat<T>[] {
  if (!cot?.length) return [...khai];
  const theoKhoa = new Map(khai.map((k) => [k.key, k]));
  const la = cot.filter((c) => !theoKhoa.has(c));
  if (la.length) {
    throw new BadRequestException(`Cột xuất không hợp lệ: ${la.join(', ')}`);
  }
  return cot.map((c) => theoKhoa.get(c) as KhaiCotXuat<T>);
}

const soVN = (n: number) => n.toLocaleString('vi-VN');

/**
 * Xuất danh sách ra Excel theo ĐÚNG bộ lọc và thứ tự của bảng — dùng chung cho Đơn thư, Vụ việc, Vụ án.
 *
 *   đếm (một lần) ──► vượt trần/rỗng → 400 (chưa ghi byte nào)
 *        │
 *   lấy id theo thứ tự danh sách (một truy vấn, chỉ cột id)
 *        │
 *   từng lô 1.000 id ──► đọc dòng ──► xếp lại theo thứ tự id ──► ghi luồng từng hàng
 *
 * Lấy id trước rồi đọc theo lô thay vì lặp `getList` theo trang: không `count` mỗi lượt, không phân
 * trang sâu, và thứ tự trong tệp khớp đúng thứ tự trên màn. Trả số dòng đã ghi.
 */
export async function xuatDanhSachExcel<T extends { id: string }>(o: {
  res: Response;
  tenTep: string;
  tenSheet: string;
  tieuDe: string;
  phuDe: string;
  cot: readonly KhaiCotXuat<T>[];
  sheetLienQuan?: readonly SheetLienQuan<T>[];
  demTong: () => Promise<number>;
  layIdTheoThuTu: (toiDa: number) => Promise<string[]>;
  layDong: (ids: string[]) => Promise<T[]>;
  tran?: number;
  lo?: number;
  /**
   * Cho xuất tệp không dòng nào (chỉ tiêu đề). Các tệp xuất PHƯỜNG/XÃ có sẵn từ trước vẫn trả tệp khi
   * rỗng — giữ hành vi ấy; xuất theo bộ lọc mới thì 400 cho rõ.
   */
  choPhepRong?: boolean;
}): Promise<number> {
  const tran = o.tran ?? TRAN_XUAT_DANH_SACH;
  const lo = o.lo ?? LO_MAC_DINH;

  const tong = await o.demTong();
  if (tong === 0 && !o.choPhepRong) {
    throw new BadRequestException('Không có dữ liệu nào khớp bộ lọc để xuất.');
  }
  if (tong > tran) {
    throw new BadRequestException(
      `Kết quả ${soVN(tong)} dòng, vượt ${soVN(tran)} dòng mỗi lần xuất — thu hẹp bộ lọc rồi xuất lại.`,
    );
  }
  const ids = await o.layIdTheoThuTu(tran);
  if (ids.length > TRAN_DONG_SHEET_EXCEL) {
    throw new BadRequestException('Sheet chính vượt giới hạn dòng Excel.');
  }
  for (const lienQuan of o.sheetLienQuan ?? []) {
    const soDong = await lienQuan.demDong(ids);
    if (soDong > TRAN_DONG_SHEET_EXCEL) {
      throw new BadRequestException(
        `Sheet ${lienQuan.ten} có ${soVN(soDong)} dòng, vượt giới hạn Excel.`,
      );
    }
  }

  o.res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  o.res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(o.tenTep)}`,
  );

  let daGhi = 0;
  // Từ đây byte đã bắt đầu đi: lỗi giữa chừng không trả được mã lỗi HTTP nữa — huỷ luồng để trình
  // duyệt thấy tải hỏng (không nhận một tệp cụt tưởng là đủ), ghi dấu vết, rồi ném tiếp.
  try {
    const soCot = o.cot.length + 1;
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: o.res,
      useStyles: true,
    });
    // Bộ ghi luồng có đủ `mergeCells`/`getCell`/`getRow` mà mẫu BCA dùng — cùng mẫu với mọi tệp xuất.
    const sheet = workbook.addWorksheet(o.tenSheet, {
      pageSetup: BcaExcelHelper.printSetup(),
    }) as unknown as ExcelJS.Worksheet;
    BcaExcelHelper.addHeader(sheet, soCot, o.tieuDe, o.phuDe);
    BcaExcelHelper.addColumnHeaders(
      sheet.getRow(HANG_TIEU_DE_COT),
      ['STT', ...o.cot.map((c) => c.tieuDe)],
      [7, ...o.cot.map((c) => c.rong)],
    );
    sheet.getRow(HANG_TIEU_DE_COT).commit();

    const sheetsPhu = (o.sheetLienQuan ?? []).map((khai) => {
      const child = workbook.addWorksheet(khai.ten, {
        pageSetup: BcaExcelHelper.printSetup(),
      }) as unknown as ExcelJS.Worksheet;
      BcaExcelHelper.addHeader(child, khai.cot.length + 1, khai.ten, o.phuDe);
      BcaExcelHelper.addColumnHeaders(
        child.getRow(HANG_TIEU_DE_COT),
        ['STT', ...khai.cot.map((c) => c.tieuDe)],
        [7, ...khai.cot.map((c) => c.rong)],
      );
      child.getRow(HANG_TIEU_DE_COT).commit();
      return { khai, child, daGhi: 0 };
    });

    for (let i = 0; i < ids.length; i += lo) {
      const phan = ids.slice(i, i + lo);
      const theoId = new Map((await o.layDong(phan)).map((d) => [d.id, d]));
      for (const id of phan) {
        const dong = theoId.get(id);
        // Dòng biến mất giữa lúc lấy id và lúc đọc (vừa bị xoá) thì bỏ qua — không ghi hàng trống.
        if (!dong) continue;
        const hang = sheet.addRow([
          daGhi + 1,
          ...o.cot.map((c) => c.doc(dong) ?? ''),
        ]);
        BcaExcelHelper.styleDataRow(hang, daGhi % 2 === 1, soCot);
        hang.commit();
        daGhi++;
        for (const phu of sheetsPhu) {
          for (const banGhi of phu.khai.layDong(dong) ?? []) {
            if (phu.daGhi >= TRAN_DONG_SHEET_EXCEL) {
              throw new BadRequestException(
                `Sheet ${phu.khai.ten} vượt giới hạn Excel.`,
              );
            }
            const hangPhu = phu.child.addRow([
              phu.daGhi + 1,
              ...phu.khai.cot.map((c) => c.doc(banGhi) ?? ''),
            ]);
            BcaExcelHelper.styleDataRow(
              hangPhu,
              phu.daGhi % 2 === 1,
              phu.khai.cot.length + 1,
            );
            hangPhu.commit();
            phu.daGhi++;
          }
        }
      }
    }

    BcaExcelHelper.addFooter(sheet, HANG_TIEU_DE_COT + daGhi + 2, soCot);
    for (const phu of sheetsPhu) {
      BcaExcelHelper.addFooter(
        phu.child,
        HANG_TIEU_DE_COT + phu.daGhi + 2,
        phu.khai.cot.length + 1,
      );
    }
    await workbook.commit();
  } catch (loi) {
    console.error('[xuatDanhSachExcel] lỗi giữa lúc ghi tệp, huỷ luồng:', loi);
    o.res.destroy(loi as Error);
    throw loi;
  }
  return daGhi;
}
