import { IncidentStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của danh sách Vụ việc — nguồn duy nhất cho cột bóng + trigger + chỉ mục,
 * field Prisma và khoá thẻ phía giao diện. Thứ tự = thứ tự cột trên `IncidentListPageShell.tsx`.
 *
 * Khoá dùng tên CHUẨN liên thực thể như Đơn thư (`nguoiGui`, `tomTat`, `donViGiaiQuyet`…), nhưng
 * cột thật theo ĐÚNG cột màn hình đang hiện: cột "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại"
 * hiện `benVu` (không phải `name`), "Nguồn đơn/Đơn vị giao" hiện `chuyenTuDonVi`.
 */
export const KHAI_TIM_KIEM_VU_VIEC: KhaiThucThe = {
  thucThe: 'vu-viec',
  bang: 'incidents',
  model: 'Incident',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'code' },
    { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', cot: 'sttCu' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    {
      key: 'nguonDon',
      nhan: 'Nguồn đơn/Đơn vị giao',
      kieu: 'chu',
      cot: 'chuyenTuDonVi',
    },
    {
      key: 'nguoiGui',
      nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      kieu: 'chu',
      cot: 'benVu',
    },
    {
      key: 'tomTat',
      nhan: 'Tóm tắt nội dung',
      kieu: 'chu',
      cot: 'description',
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
      cot: 'ketQuaXuLy',
    },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'canBoNhap',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(IncidentStatus),
    },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên',
      kieu: 'nguoi',
      quanHe: 'investigator',
    },
    { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay', cot: 'deadline' },
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt' },
  ],
  // Ô tìm cũ tìm cả tên vụ việc, đối tượng bị tố giác (cá nhân/tổ chức) và số hồ sơ hệ cũ — thẻ
  // "tất cả các cột" phải tìm được đủ, không giảm phạm vi tìm của cán bộ.
  cotThemVaoTatCa: ['name', 'doiTuongCaNhan', 'doiTuongToChuc', 'soHoSoCu'],
};
