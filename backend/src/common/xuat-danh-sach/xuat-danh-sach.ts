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
      }
    }

    BcaExcelHelper.addFooter(sheet, HANG_TIEU_DE_COT + daGhi + 2, soCot);
    await workbook.commit();
  } catch (loi) {
    console.error('[xuatDanhSachExcel] lỗi giữa lúc ghi tệp, huỷ luồng:', loi);
    o.res.destroy(loi as Error);
    throw loi;
  }
  return daGhi;
}
