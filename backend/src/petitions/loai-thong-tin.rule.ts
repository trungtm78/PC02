import { LoaiDon } from '@prisma/client';
import { khoaLoaiThongTin, nhomHanTheoTen } from '../common/utils/khoa-loai-thong-tin.util';

/**
 * Nhóm hạn của đơn thư — suy từ ô "Loại thông tin" qua danh mục `LOAI_THONG_TIN`.
 *
 * Từ 14/09/2026 form chỉ còn MỘT ô "Loại thông tin" (như hệ cũ); cột `petitionType` giữ lại làm
 * NHÓM HẠN vì khối tự tính hạn, xuất Excel, số văn bản và đồng bộ Vụ án đều đọc nó.
 *
 *      loaiThongTin ──khoá gộp──► mục danh mục ──metadata.nhomHan──► petitionType ──► hạn
 *                                     │ (không có mục / nhomHan lạ)
 *                                     └──────────► nhomHanTheoTen(loaiThongTin)
 *
 * Danh mục THẮNG luật theo tên: quản trị viên sửa nhóm hạn của một mục thì đơn mới chọn mục ấy
 * tính hạn theo giá trị mới, không phải sửa mã.
 */

/** Mục danh mục tối thiểu cần để tra nhóm hạn. */
export interface MucLoaiThongTin {
  name: string;
  metadata: unknown;
}

const NHOM_HAN_HOP_LE = new Set<string>(Object.values(LoaiDon));

function nhomHanTrongMetadata(metadata: unknown): LoaiDon | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const nhomHan = (metadata as Record<string, unknown>).nhomHan;
  // Giá trị lạ không được đi vào cột enum — Prisma ném lỗi ngay khi ghi.
  return typeof nhomHan === 'string' && NHOM_HAN_HOP_LE.has(nhomHan)
    ? (nhomHan as LoaiDon)
    : undefined;
}

/**
 * @returns nhóm hạn, hoặc `undefined` khi hồ sơ không mang loại thông tin (không tự gán nhóm cho
 *          hồ sơ không có loại — khối tính hạn tự rơi về nhánh mặc định).
 */
export function nhomHanCuaLoaiThongTin(
  loaiThongTin: string | null | undefined,
  danhMuc: readonly MucLoaiThongTin[],
): LoaiDon | undefined {
  const khoa = khoaLoaiThongTin(loaiThongTin);
  if (!khoa) return undefined;
  const muc = danhMuc.find((m) => khoaLoaiThongTin(m.name) === khoa);
  return nhomHanTrongMetadata(muc?.metadata) ?? nhomHanTheoTen(loaiThongTin);
}
