// AUTO-GENERATED — SINH TỰ ĐỘNG bởi `cd backend && npm run gen:tim-kiem` — không sửa tay.
// Nguồn: backend/src/common/tim-kiem/khai/*.khai.ts

export type KieuTruongTimKiem = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi' | 'doi-tuong' | 'quan-he' | 'ma-thuong';

export const TIM_KIEM_DON_THU = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
  { key: 'nguonDon', nhan: 'Nguồn đơn/Đơn vị giao', kieu: 'chu' },
  { key: 'nguoiGui', nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại', kieu: 'chu' },
  { key: 'tomTat', nhan: 'Tóm tắt nội dung', kieu: 'chu' },
  { key: 'donViGiaiQuyet', nhan: 'Đơn vị giải quyết', kieu: 'chu' },
  { key: 'ketQuaXuLyKhac', nhan: 'Kết quả xử lý, giải quyết khác', kieu: 'chu' },
  { key: 'nguoiNhap', nhan: 'Người nhập', kieu: 'nguoi' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  { key: 'doiTuong', nhan: 'Đối tượng bị tố', kieu: 'chu' },
  { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
] as const;

export const TIM_KIEM_VU_VIEC = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
  { key: 'nguonDon', nhan: 'Nguồn đơn/Đơn vị giao', kieu: 'chu' },
  { key: 'nguoiGui', nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại', kieu: 'chu' },
  { key: 'tomTat', nhan: 'Tóm tắt nội dung', kieu: 'chu' },
  { key: 'donViGiaiQuyet', nhan: 'Đơn vị giải quyết', kieu: 'chu' },
  { key: 'ketQuaXuLyKhac', nhan: 'Kết quả xử lý, giải quyết khác', kieu: 'chu' },
  { key: 'nguoiNhap', nhan: 'Người nhập', kieu: 'nguoi' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  { key: 'dieuTraVien', nhan: 'Điều tra viên', kieu: 'nguoi' },
  { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
] as const;

export const TIM_KIEM_VU_AN = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
  { key: 'doiTuongBiCan', nhan: 'Đối tượng bị can', kieu: 'doi-tuong' },
  { key: 'nguonDon', nhan: 'Nguồn đơn/Đơn vị giao', kieu: 'chu' },
  { key: 'nguoiGui', nhan: 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại', kieu: 'chu' },
  { key: 'tomTat', nhan: 'Tóm tắt nội dung', kieu: 'chu' },
  { key: 'donViGiaiQuyet', nhan: 'Đơn vị giải quyết', kieu: 'chu' },
  { key: 'ketQuaXuLyKhac', nhan: 'Kết quả xử lý, giải quyết khác', kieu: 'chu' },
  { key: 'nguoiNhap', nhan: 'Người nhập', kieu: 'nguoi' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  { key: 'dieuTraVien', nhan: 'Điều tra viên', kieu: 'nguoi' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
  { key: 'ngayTiepNhan', nhan: 'Ngày tiếp nhận', kieu: 'ngay' },
  { key: 'donViGiao', nhan: 'Đơn vị giao', kieu: 'chu' },
  { key: 'soQuyetDinh', nhan: 'Số QĐ/Phiếu', kieu: 'chu' },
  { key: 'doiTuongNghiVan', nhan: 'Đối tượng nghi vấn', kieu: 'chu' },
  { key: 'toiDanh', nhan: 'Tội danh', kieu: 'chu' },
  { key: 'thoiHan', nhan: 'Thời hạn', kieu: 'ngay' },
] as const;

export const TIM_KIEM_DOI_TUONG = [
  { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu' },
  { key: 'cccd', nhan: 'CCCD', kieu: 'chu' },
  { key: 'vuAn', nhan: 'Vụ án', kieu: 'quan-he' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
] as const;

export const TIM_KIEM_LUAT_SU = [
  { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu' },
  { key: 'soThe', nhan: 'Số thẻ', kieu: 'chu' },
  { key: 'vanPhong', nhan: 'Văn phòng', kieu: 'chu' },
  { key: 'vuAn', nhan: 'Vụ án', kieu: 'quan-he' },
  { key: 'thanChu', nhan: 'Bị can / Thân chủ', kieu: 'quan-he' },
  { key: 'sdt', nhan: 'SĐT', kieu: 'chu' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
] as const;
