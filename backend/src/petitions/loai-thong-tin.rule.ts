import { LoaiDon, type Prisma } from '@prisma/client';
import {
  LOAI_DANH_MUC_LOAI_THONG_TIN,
  khoaLoaiThongTin,
  nhomHanTheoTen,
} from '../common/utils/khoa-loai-thong-tin.util';

/**
 * Nhóm hạn của đơn thư — suy từ ô "Loại thông tin" qua danh mục `LOAI_THONG_TIN`.
 *
 * Từ 14/09/2026 form chỉ còn MỘT ô "Loại thông tin" (như hệ cũ); cột `petitionType` giữ lại làm
 * NHÓM HẠN vì khối tự tính hạn, xuất Excel, số văn bản và đồng bộ Vụ án đều đọc nó.
 *
 *      loaiThongTin ──khoá gộp──► mục danh mục ──metadata.nhomHan──► petitionType ──► hạn
 *                                     │ (không có mục / nhomHan lạ)
 *                                     └──────────► nhomHanTheoTen(tên)
 *
 * Danh mục THẮNG luật theo tên: quản trị viên sửa nhóm hạn của một mục thì đơn mới chọn mục ấy
 * tính hạn theo giá trị mới, không phải sửa mã. MỘT bộ luật cho form (petitions.service), bộ nạp hệ
 * cũ và CLI nạp danh mục.
 */

/** Mục danh mục tối thiểu cần để tra nhóm hạn. */
export interface MucLoaiThongTin {
  name: string;
  metadata: unknown;
}

/** Mục danh mục theo khoá gộp. */
export type ChiMucLoaiThongTin = ReadonlyMap<string, MucLoaiThongTin>;

export interface LoaiThongTinChuan {
  /** Tên của mục danh mục; không có mục thì chữ gõ ở dạng NFC, gộp khoảng trắng. */
  ten: string;
  nhomHan: LoaiDon;
}

/**
 * Truy vấn danh mục để tra nhóm hạn: CHỈ mục đang dùng, sắp theo mã.
 *
 * Bảng `directories` chỉ duy nhất theo (type, code) — hai mục có thể cùng khoá tên. Không sắp thì
 * mục thắng phụ thuộc thứ tự dòng PostgreSQL trả về, và hạn pháp lý đổi giữa hai lần lưu.
 */
export const TRUY_VAN_DANH_MUC_LOAI_THONG_TIN = {
  where: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, isActive: true },
  select: { name: true, metadata: true },
  orderBy: { code: 'asc' },
} satisfies Prisma.DirectoryFindManyArgs;

const NHOM_HAN_HOP_LE = new Set<string>(Object.values(LoaiDon));

function nhomHanTrongMetadata(metadata: unknown): LoaiDon | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const nhomHan = (metadata as Record<string, unknown>).nhomHan;
  // Giá trị lạ không được đi vào cột enum — Prisma ném lỗi ngay khi ghi.
  return typeof nhomHan === 'string' && NHOM_HAN_HOP_LE.has(nhomHan)
    ? (nhomHan as LoaiDon)
    : undefined;
}

/** Nhóm hạn của một mục: `metadata.nhomHan` hợp lệ, không thì theo tên của mục. */
export function nhomHanCuaMuc(muc: MucLoaiThongTin): LoaiDon {
  return nhomHanTrongMetadata(muc.metadata) ?? nhomHanTheoTen(muc.name);
}

/** Chỉ mục theo khoá gộp. Hai mục cùng khoá → mục ĐỨNG TRƯỚC thắng (truy vấn đã sắp theo mã). */
export function lapChiMucLoaiThongTin(
  danhMuc: readonly MucLoaiThongTin[],
): ChiMucLoaiThongTin {
  const chiMuc = new Map<string, MucLoaiThongTin>();
  for (const muc of danhMuc) {
    const khoa = khoaLoaiThongTin(muc.name);
    if (khoa && !chiMuc.has(khoa)) chiMuc.set(khoa, muc);
  }
  return chiMuc;
}

/** Tên chuẩn + nhóm hạn của một giá trị đã biết khoá (khoá khác rỗng). */
export function traLoaiTheoKhoa(
  khoa: string,
  giaTri: string,
  chiMuc: ChiMucLoaiThongTin,
): LoaiThongTinChuan {
  const muc = chiMuc.get(khoa);
  if (muc) return { ten: muc.name, nhomHan: nhomHanCuaMuc(muc) };
  const ten = giaTri.normalize('NFC').replace(/\s+/g, ' ').trim();
  return { ten, nhomHan: nhomHanTheoTen(ten) };
}

/** Tên chuẩn + nhóm hạn; `undefined` khi hồ sơ không mang loại (không tự gán nhóm hạn). */
export function traLoaiThongTin(
  giaTri: string | null | undefined,
  chiMuc: ChiMucLoaiThongTin,
): LoaiThongTinChuan | undefined {
  const khoa = khoaLoaiThongTin(giaTri);
  return khoa ? traLoaiTheoKhoa(khoa, giaTri as string, chiMuc) : undefined;
}

/**
 * @returns nhóm hạn, hoặc `undefined` khi hồ sơ không mang loại thông tin (khối tính hạn tự rơi về
 *          nhánh mặc định).
 */
export function nhomHanCuaLoaiThongTin(
  loaiThongTin: string | null | undefined,
  danhMuc: readonly MucLoaiThongTin[],
): LoaiDon | undefined {
  return traLoaiThongTin(loaiThongTin, lapChiMucLoaiThongTin(danhMuc))?.nhomHan;
}
