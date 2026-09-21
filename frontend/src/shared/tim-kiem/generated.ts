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
  { key: 'ngayTiepNhan', nhan: 'Ngày tiếp nhận', kieu: 'ngay' },
  { key: 'ngayTiepNhanNguonTin', nhan: 'Ngày tiếp nhận nguồn tin', kieu: 'ngay' },
  { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay' },
  { key: 'ngayGiaoDonViGiaiQuyet', nhan: 'Ngày giao đơn vị giải quyết', kieu: 'ngay' },
  { key: 'ngayPhieuChuyen', nhan: 'Ngày phiếu chuyển', kieu: 'ngay' },
  { key: 'ngayCapCCCD', nhan: 'Ngày cấp CCCD', kieu: 'ngay' },
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
  { key: 'ngayTiepNhanNguonTin', nhan: 'Ngày tiếp nhận nguồn tin', kieu: 'ngay' },
  { key: 'ngayQDPhanCongNguonTin', nhan: 'Ngày QĐ phân công nguồn tin', kieu: 'ngay' },
  { key: 'ngayGiaoDonViGiaiQuyet', nhan: 'Ngày giao đơn vị giải quyết', kieu: 'ngay' },
  { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay' },
  { key: 'ngayPhieuChuyen', nhan: 'Ngày phiếu chuyển', kieu: 'ngay' },
  { key: 'ngayCapCCCD', nhan: 'Ngày cấp CCCD', kieu: 'ngay' },
  { key: 'toiDanhChinh', nhan: 'Tội danh chính', kieu: 'quan-he' },
  { key: 'tenVuViec', nhan: 'Tên vụ việc', kieu: 'chu' },
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
  { key: 'ngayNhan', nhan: 'Ngày nhận', kieu: 'ngay' },
  { key: 'ngayPhieuChuyen', nhan: 'Ngày phiếu chuyển', kieu: 'ngay' },
  { key: 'ngayKhoiTo', nhan: 'Ngày khởi tố', kieu: 'ngay' },
  { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay' },
  { key: 'ngayCapCCCD', nhan: 'Ngày cấp CCCD', kieu: 'ngay' },
  { key: 'ngayTiepNhan', nhan: 'Ngày tiếp nhận', kieu: 'ngay' },
  { key: 'donViGiao', nhan: 'Đơn vị giao', kieu: 'chu' },
  { key: 'soQuyetDinh', nhan: 'Số QĐ/Phiếu', kieu: 'chu' },
  { key: 'doiTuongNghiVan', nhan: 'Đối tượng nghi vấn', kieu: 'chu' },
  { key: 'toiDanh', nhan: 'Tội danh', kieu: 'chu' },
  { key: 'toiDanhChinh', nhan: 'Tội danh chính', kieu: 'quan-he' },
  { key: 'thoiHan', nhan: 'Thời hạn', kieu: 'ngay' },
  { key: 'tenVuAn', nhan: 'Tên vụ án', kieu: 'chu' },
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

export const TIM_KIEM_NGUOI_DUNG = [
  { key: 'maCanBo', nhan: 'Mã cán bộ', kieu: 'ma-thuong' },
  { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu' },
  { key: 'email', nhan: 'Email', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  { key: 'dangNhapCuoi', nhan: 'Đăng nhập cuối', kieu: 'ngay' },
] as const;

export const TIM_KIEM_DANH_MUC = [
  { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong' },
  { key: 'ten', nhan: 'Tên danh mục', kieu: 'chu' },
  { key: 'moTa', nhan: 'Mô tả', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_TAI_LIEU = [
  { key: 'tieuDe', nhan: 'Tiêu đề', kieu: 'chu' },
  { key: 'tenTep', nhan: 'Tên tệp', kieu: 'chu' },
  { key: 'moTa', nhan: 'Mô tả', kieu: 'chu' },
  { key: 'loai', nhan: 'Loại', kieu: 'chon' },
  { key: 'vuAn', nhan: 'Vụ án', kieu: 'quan-he' },
  { key: 'vuViec', nhan: 'Vụ việc', kieu: 'quan-he' },
  { key: 'nguoiTaiLen', nhan: 'Người upload', kieu: 'nguoi' },
  { key: 'ngayTaiLen', nhan: 'Ngày upload', kieu: 'ngay' },
] as const;

export const TIM_KIEM_ANH_XA_DIA_CHI = [
  { key: 'phuongCu', nhan: 'Phường/Xã cũ', kieu: 'chu' },
  { key: 'quanCu', nhan: 'Quận/Huyện cũ', kieu: 'chu' },
  { key: 'phuongMoi', nhan: 'Phường/Xã mới', kieu: 'chu' },
  { key: 'tinh', nhan: 'Tỉnh', kieu: 'ma-thuong' },
  { key: 'ghiChu', nhan: 'Ghi chú', kieu: 'chu' },
  { key: 'canXemLai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_NHAT_KY = [
  { key: 'thoiGian', nhan: 'Thời gian', kieu: 'ngay' },
  { key: 'nguoiThucHien', nhan: 'Người thực hiện', kieu: 'nguoi' },
  { key: 'thaoTac', nhan: 'Thao tác', kieu: 'ma-thuong' },
  { key: 'loaiDoiTuong', nhan: 'Loại đối tượng', kieu: 'ma-thuong' },
  { key: 'maDoiTuong', nhan: 'Mã đối tượng', kieu: 'ma-thuong' },
  { key: 'ip', nhan: 'IP', kieu: 'ma-thuong' },
] as const;

export const TIM_KIEM_HUONG_DAN = [
  { key: 'ngay', nhan: 'Ngày', kieu: 'ngay' },
  { key: 'vanDe', nhan: 'Vấn đề', kieu: 'chu' },
  { key: 'donVi', nhan: 'Đơn vị', kieu: 'chu' },
  { key: 'nguoiNhap', nhan: 'Người nhập', kieu: 'nguoi' },
  { key: 'nguoiDuocHuongDan', nhan: 'Người được hướng dẫn', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_KIEN_NGHI = [
  { key: 'maKienNghi', nhan: 'Mã kiến nghị', kieu: 'ma-thuong' },
  { key: 'hoSoLienQuan', nhan: 'Mã hồ sơ liên quan', kieu: 'quan-he' },
  { key: 'noiDung', nhan: 'Nội dung kiến nghị', kieu: 'chu' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
  { key: 'donViVks', nhan: 'Đơn vị VKS', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_UY_THAC = [
  { key: 'soUyThac', nhan: 'Số ủy thác', kieu: 'ma-thuong' },
  { key: 'hoSoLienQuan', nhan: 'Hồ sơ liên quan', kieu: 'quan-he' },
  { key: 'noiDung', nhan: 'Nội dung', kieu: 'chu' },
  { key: 'ngayUyThac', nhan: 'Ngày ủy thác', kieu: 'ngay' },
  { key: 'donViNhan', nhan: 'Đơn vị nhận', kieu: 'chu' },
  { key: 'nguoiTao', nhan: 'Người tạo', kieu: 'nguoi' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_TRAO_DOI = [
  { key: 'maHoSo', nhan: 'Mã hồ sơ', kieu: 'ma-thuong' },
  { key: 'loaiHoSo', nhan: 'Loại hồ sơ', kieu: 'chu' },
  { key: 'donViGui', nhan: 'Đơn vị gửi', kieu: 'chu' },
  { key: 'donViNhan', nhan: 'Đơn vị nhận', kieu: 'chu' },
  { key: 'thoiGianKhoiTao', nhan: 'Thời gian khởi tạo', kieu: 'ngay' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

export const TIM_KIEM_TOI_DANH = [
  { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong' },
  { key: 'ten', nhan: 'Tên tội danh', kieu: 'chu' },
] as const;
