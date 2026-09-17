import { PetitionStatus } from '@prisma/client';

/**
 * Tiêu chí gom nhóm đơn trùng → CỘT CHUẨN HOÁ tương ứng (migration `don_trung_chuan_hoa`).
 *
 * Bảng này là nguồn DUY NHẤT: danh sách, tệp xuất và DTO cùng đọc, nên thêm tiêu chí là thêm một dòng.
 */
export const COT_TIEU_CHI_TRUNG = {
  senderName: 'senderNameChuan',
  senderPhone: 'senderPhoneChuan',
  senderAddress: 'senderAddressChuan',
  suspectedPerson: 'suspectedPersonChuan',
} as const;

export type TieuChiTrung = keyof typeof COT_TIEU_CHI_TRUNG;
export const TIEU_CHI_TRUNG = Object.keys(COT_TIEU_CHI_TRUNG) as TieuChiTrung[];

/**
 * Giá trị KHÔNG phải "một người gửi nhiều lần" nên không lập nhóm trùng. Đo prod 17/09/2026: nhóm
 * "nặc danh" có 183 đơn, gom lại chỉ tạo một khối nhiễu che các nhóm thật.
 */
export const LOAI_KHOI_NHOM_TRUNG = ['nặc danh'];

export interface DonTrong {
  id: string;
  stt: string | null;
  senderName: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  suspectedPerson?: string | null;
  detailContent?: string | null;
  ngayDeXuat: Date | null;
  status: PetitionStatus;
}

export interface NhomDonTrung {
  /** Giá trị gom (đã chuẩn hoá) — cột "Trùng theo" trên màn. */
  giaTri: string;
  soDon: number;
  /** Đơn tiếp nhận sớm nhất nhóm — cột "Hồ sơ gốc". */
  goc: DonTrong | null;
  dons: DonTrong[];
}

/** Nhãn tiêu chí — máy chủ dùng cho tiêu đề tệp xuất, giao diện dùng cho ô chọn (một nguồn). */
export const NHAN_TIEU_CHI_TRUNG: Record<TieuChiTrung, string> = {
  senderName: 'Họ tên người gửi',
  senderPhone: 'Số điện thoại',
  senderAddress: 'Địa chỉ',
  suspectedPerson: 'Đối tượng bị tố giác',
};

/** Số đơn lấy về mỗi nhóm ở màn danh sách (bảng vẫn hiện TỔNG số đơn của nhóm). */
export const SO_DON_MOI_NHOM = 20;

export interface TuyChonNhomTrung {
  /** `null` = lấy trọn đơn của nhóm (đường xuất Excel). Bỏ trống = `SO_DON_MOI_NHOM`. */
  soDonMoiNhom?: number | null;
  /** Lấy MỌI nhóm trong một lượt (đường xuất Excel) thay vì theo trang. */
  tatCaNhom?: boolean;
}

/**
 * Bí danh tiếng Việt của tiêu chí — đường xuất Excel trước 18/09/2026 nhận các nhãn này, nên đường dẫn
 * cán bộ đã lưu vẫn phải chạy.
 */
export const BI_DANH_TIEU_CHI_TRUNG: Record<string, TieuChiTrung> = {
  'Họ tên': 'senderName',
  'Số điện thoại': 'senderPhone',
  'Địa chỉ': 'senderAddress',
  'Bị đơn trùng': 'suspectedPerson',
  'Đối tượng bị tố giác': 'suspectedPerson',
};
