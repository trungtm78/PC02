/** Ba loại hồ sơ có mặt trên màn Chuyển đội / Trả hồ sơ. */
export const LOAI_HO_SO_CHUYEN_TRA = ['Vụ án', 'Vụ việc', 'Đơn thư'] as const;
export type LoaiHoSoChuyenTra = (typeof LOAI_HO_SO_CHUYEN_TRA)[number];

export interface DongChuyenTra {
  id: string;
  loai: LoaiHoSoChuyenTra;
  /** Mã hồ sơ thật: `caseCode` / `code` / `stt` tuỳ loại (KHÔNG cắt id). */
  ma: string | null;
  ten: string;
  toId: string | null;
  toTen: string;
  nguoiPhuTrach: string;
  ngayDeXuat: Date | string | null;
  trangThai: string;
}

/**
 * Trần số dòng gộp về từ MỖI nguồn cho một lượt hỏi.
 *
 * Gộp ba bảng rồi cắt trang thì trang N cần N×20 dòng đầu của mỗi nguồn (dòng của trang N có thể nằm ở
 * bất kỳ nguồn nào). Đi quá sâu là kéo cả bảng về, nên dừng ở đây và NÓI RA thay vì trả trang thiếu.
 */
export const TRAN_GOP_MOI_NGUON = 2000;
