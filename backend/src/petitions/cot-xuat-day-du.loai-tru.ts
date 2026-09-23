/**
 * Cột BỊ CẮT khỏi tệp "Xuất Excel (mọi trường)" — sinh từ PHÉP ĐO, không chép tay.
 *
 * Anh báo 23/09/2026: tệp xuất ra "rất nhiều field dư thừa". Đo trên bản sao prod cùng ngày,
 * 46.741 hồ sơ chưa xoá:
 *
 *     tổng cột trong tệp          130   (42 cột riêng + 88 khoá `metadata`)
 *     khoá `metadata` RỖNG        88/88  — không hồ sơ nào có dữ liệu
 *
 * Tức 68% tệp là cột trắng. Chúng là ô của giai đoạn **Vụ án / Vụ việc** (Quyết định khởi tố,
 * Tạm đình chỉ, Vật chứng, TK 48 trường…) — một đơn thư chưa chuyển thì không bao giờ đi tới
 * chúng. Chúng vào tệp chỉ vì bảng xuất lấy BỐ CỤC HỆ CŨ làm thước đo thay vì DỮ LIỆU THẬT.
 *
 * ── VÌ SAO KHÔNG XOÁ HẲN KHỎI BẢN SINH ──
 *
 * `khai-truong-form-don-thu.generated.ts` giữ nguyên trọn 130 trường: nó là sự thật về FORM.
 * Tệp này là sự thật về TỆP XUẤT. Tách hai thứ ra thì không lẫn "form có ô này" với "tệp xuất
 * ô này", và ngày ô nào đó bắt đầu có dữ liệu thì chỉ phải xoá một dòng ở đây.
 *
 * ── VÌ SAO PHẢI ĐO LẠI ĐỊNH KỲ ──
 *
 * "Rỗng" là sự thật của HÔM NAY. Ngày cán bộ bắt đầu nhập một ô đã cắt, tệp xuất IM LẶNG thiếu
 * cột ấy — tệp vẫn ra, vẫn đủ tiêu đề, chỉ thiếu. `npm run kiem:cot-xuat-day-du` đo lại và ĐỎ
 * khi điều đó xảy ra; `deploy.sh` chạy nó ở chế độ chỉ đọc mỗi lần deploy.
 *
 * Sinh lại: `npm run kiem:cot-xuat-day-du -- --sinh`
 *
 * KHÔNG cắt 6 ô trong hai nhóm gập (CCCĐ, ngày/nơi cấp, sinh năm, Điều tra viên, Lãnh đạo tố
 * tụng): chúng CÓ dữ liệu thật (3.335 hồ sơ có CCCĐ) và chỉ cách một cú bấm. Gập là để nhập cho
 * nhanh, không phải vì ô không quan trọng.
 */
export interface CotLoaiTru {
  /** Khoá trong `metadata` — khớp `khoaLuu` của bản sinh. */
  khoaLuu: string;
  /** Lý do KÈM SỐ ĐO, không phải lý do viết sẵn. */
  lyDo: string;
  /** Ngày đo. Số đo cũ hơn một đợt di trú là số đo phải chạy lại. */
  doNgay: string;
}

export const COT_XUAT_DAY_DU_LOAI_TRU: readonly CotLoaiTru[] = [
  { khoaLuu: 'vatChungMoTa', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'lenhNhapKho', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'noiLuuTruBaoQuan', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDangKyHoSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDangKyHoSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'hoSoLuu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayNopLuuHoSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'donViBaoQuanHoSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDKhongKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayQDKhongKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuKhongKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoKhongKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'chuyenVuViecDonViKhac', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'nhapVaoVuViecSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'phanLoaiDanSu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'capDoToiPham', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'toiDanhChinhKhoiToId', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'toiDanhKhacIds', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayKhoiTo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDNhapVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayNhapVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ghiChuNhapHoSo', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDTachVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTachVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDTachHanhVi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTachHanhVi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soKLDT', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayKLDT', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDDieuTraLai', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayQDDieuTraLai', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDDinhChiVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDinhChiVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'chuyenVuAnChoCQK', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soBanAnCoHieuLuc', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayBanAnCoHieuLuc', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'vuViecTamDungTruoc2015', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoTamDinhChiNguonTin', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayHetThoiHieuVuViec', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'khacPhucLyDoTDCVuViec', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tienDoKhacPhucTDCVuViec', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhTamDinhChi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTamDinhChi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuTamDinhChiVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoTamDinhChiVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayHetThoiHieu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tdcKhacPhucBienBan', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tdcKhacPhucLyDoBienPhap', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhPhucHoi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhucHoi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuPhucHoiVuAn', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayThongKe', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhanCongGiaiQuyetToGiac', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTiepNhanTin', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDauThu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhamToiQuaTang', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayBatKhanCap', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhatHienDauHieu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soTienThuHoi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuong', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongDaBat', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongBiBatVuAnKhac', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'dieuTraMoRong', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'suDungVuKhiNong', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soLuongNguoiChet', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soNguoiBiThuong', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'coBangNhom', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soBangNhomBatDuoc', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soSungThuHoi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soThuocNoThuHoi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'coVPHC', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongVPHC', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soNguoiBiPhatTien', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tongTienPhatHanhChinh', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongSuuTraHiemNghi', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'coGhiAmGhiHinh', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanGhiLoiKhai', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soBienBanGhiLoiKhaiCoGhiAm', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'laVuAnGhiAmGhiHinh', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanHoiCung', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanHoiCungCoGhiAm', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soBiCanCoGhiAm', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'vksYeuCauGhiAm', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'soBiCanVksYeuCauGhiAm', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'vuAnDaDuocXetXu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'ghiAmGhiHinhDaDuocXetXu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'coSuDungKQGhiAmTrongXetXu', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
  { khoaLuu: 'khongGAGHNhungToaYeuCau', lyDo: 'rỗng 0/46741 hồ sơ', doNgay: '2026-09-23' },
];
