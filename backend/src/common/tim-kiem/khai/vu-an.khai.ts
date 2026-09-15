import { CaseStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của bảng `cases` — DÙNG CHUNG cho danh sách Vụ án (`CaseListPageShell.tsx`)
 * và Ủy thác điều tra (`UyThacDieuTraListPage.tsx`): cùng một bảng, cùng endpoint `/cases`. Gợi ý
 * thẻ trên mỗi màn chỉ lấy các cột màn ấy đang hiện, nên trường riêng UTDT không lẫn sang Vụ án.
 *
 * Cột thật theo ĐÚNG cột màn hình: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" hiện
 * `tenCungCap` (không phải `name` — tên vụ án), "Tóm tắt nội dung" hiện `moTaChiTiet`.
 * "Đối tượng nghi vấn" UTDT dùng cột typed `nghiVanDoiTuong` — đo prod 15/09 phủ đúng như
 * `metadata.nghiVanDoiTuong` (2.170 = 2.170), mà cột typed có cột bóng và chỉ mục.
 */
export const KHAI_TIM_KIEM_VU_AN: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'caseCode' },
    { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', cot: 'sttCu' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    {
      key: 'doiTuongBiCan',
      nhan: 'Đối tượng bị can',
      kieu: 'doi-tuong',
      quanHe: 'subjects',
      loaiDoiTuong: 'SUSPECT',
    },
    {
      key: 'nguonDon',
      nhan: 'Nguồn đơn/Đơn vị giao',
      kieu: 'chu',
      cot: 'nguonDon',
    },
    {
      key: 'nguoiGui',
      nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      kieu: 'chu',
      cot: 'tenCungCap',
    },
    {
      key: 'tomTat',
      nhan: 'Tóm tắt nội dung',
      kieu: 'chu',
      cot: 'moTaChiTiet',
    },
    {
      key: 'donViGiaiQuyet',
      nhan: 'Đơn vị giải quyết',
      kieu: 'chu',
      cot: 'donViGiaiQuyet',
    },
    {
      key: 'ketQuaXuLyKhac',
      nhan: 'Kết quả xử lý, giải quyết khác',
      kieu: 'chu',
      cot: 'ketQuaXuLyKhac',
    },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'createdBy',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(CaseStatus),
    },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên',
      kieu: 'nguoi',
      quanHe: 'investigator',
    },
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt' },
    // ── Cột riêng màn Ủy thác điều tra ──
    {
      key: 'ngayTiepNhan',
      nhan: 'Ngày tiếp nhận',
      kieu: 'ngay',
      cot: 'ngayTiepNhan',
    },
    {
      key: 'donViGiao',
      nhan: 'Đơn vị giao',
      kieu: 'chu',
      cot: 'donViGiao',
      cotDb: 'don_vi_giao',
    },
    {
      key: 'soQuyetDinh',
      nhan: 'Số QĐ/Phiếu',
      kieu: 'chu',
      cot: 'soQuyetDinhUyThac',
      cotDb: 'so_quyet_dinh_uy_thac',
    },
    {
      key: 'doiTuongNghiVan',
      nhan: 'Đối tượng nghi vấn',
      kieu: 'chu',
      cot: 'nghiVanDoiTuong',
    },
    { key: 'toiDanh', nhan: 'Tội danh', kieu: 'chu', cot: 'crime' },
    {
      key: 'thoiHan',
      nhan: 'Thời hạn',
      kieu: 'ngay',
      cot: 'thoiHanUyThac',
    },
  ],
  // Ô tìm cũ tìm cả tên vụ án và số hồ sơ hệ cũ — thẻ "tất cả các cột" phải tìm được đủ.
  // (`unit` rỗng ở toàn bộ vụ án nên không đưa vào.)
  cotThemVaoTatCa: ['name', 'soHoSoCu'],
};
