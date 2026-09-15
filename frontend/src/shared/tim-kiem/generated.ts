// AUTO-GENERATED — SINH TỰ ĐỘNG bởi `cd backend && npm run gen:tim-kiem` — không sửa tay.
// Nguồn: backend/src/common/tim-kiem/khai/*.khai.ts

export type KieuTruongTimKiem = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi';

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
