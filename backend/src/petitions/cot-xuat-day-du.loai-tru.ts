/**
 * Cột BỊ CẮT khỏi tệp "Xuất Excel (mọi trường)" — sinh từ PHÉP ĐO, không chép tay.
 *
 * Anh báo 23/09/2026 hai lần: lần đầu "rất nhiều field dư thừa", lần sau "rà soát lại nếu trường
 * nào trong toàn bộ data không có thì không đưa field đó vào".
 *
 * Đo trên PROD, 47.626 hồ sơ chưa xoá (lần đầu đo trên bản sao và BỎ SÓT 42 cột riêng):
 *
 *     tổng trường của form        130   (42 cột riêng + 88 khoá `metadata`)
 *     khoá `metadata` RỖNG        88/88
 *     cột riêng RỖNG               3/42  — lanhDaoToTung · ngayXayRa · noiXayRaPhuongXa
 *     còn lại trong tệp            42    (39 cột riêng + 3 cột định danh)
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
  /**
   * Khoá của bản sinh. Ô `metadata` thì là khoá trong `metadata`; cột riêng thì chính là TÊN
   * CỘT (bản sinh đặt `khoaLuu = cot` cho nhánh có cột riêng).
   */
  khoaLuu: string;
  /**
   * Loại chỗ lưu — quyết định phép đo nào áp dụng.
   *
   * Đo nhầm loại thì kết quả LUÔN là 0 và cổng không bao giờ đỏ: đếm một cột riêng bằng
   * `jsonb_each` trên `metadata` thì không đời nào thấy khoá ấy. Xanh rỗng.
   */
  loai: 'metadata' | 'cot';
  /** Lý do KÈM SỐ ĐO, không phải lý do viết sẵn. */
  lyDo: string;
  /** Ngày đo. Số đo cũ hơn một đợt di trú là số đo phải chạy lại. */
  doNgay: string;
}

export const COT_XUAT_DAY_DU_LOAI_TRU: readonly CotLoaiTru[] = [
  { khoaLuu: 'vatChungMoTa', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'lenhNhapKho', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'noiLuuTruBaoQuan', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDangKyHoSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDangKyHoSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'hoSoLuu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayNopLuuHoSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'donViBaoQuanHoSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDKhongKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayQDKhongKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuKhongKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoKhongKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'chuyenVuViecDonViKhac', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'nhapVaoVuViecSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'phanLoaiDanSu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'capDoToiPham', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'toiDanhChinhKhoiToId', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'toiDanhKhacIds', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayKhoiTo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDNhapVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayNhapVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ghiChuNhapHoSo', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDTachVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTachVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDTachHanhVi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTachHanhVi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soKLDT', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayKLDT', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDDieuTraLai', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayQDDieuTraLai', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQDDinhChiVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDinhChiVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'chuyenVuAnChoCQK', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soBanAnCoHieuLuc', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayBanAnCoHieuLuc', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'vuViecTamDungTruoc2015', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoTamDinhChiNguonTin', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayHetThoiHieuVuViec', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'khacPhucLyDoTDCVuViec', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tienDoKhacPhucTDCVuViec', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhTamDinhChi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTamDinhChi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuTamDinhChiVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'lyDoTamDinhChiVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayHetThoiHieu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tdcKhacPhucBienBan', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tdcKhacPhucLyDoBienPhap', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soQuyetDinhPhucHoi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhucHoi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'canCuPhucHoiVuAn', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayThongKe', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhanCongGiaiQuyetToGiac', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayTiepNhanTin', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayDauThu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhamToiQuaTang', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayBatKhanCap', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayPhatHienDauHieu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soTienThuHoi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuong', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongDaBat', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongBiBatVuAnKhac', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'dieuTraMoRong', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'suDungVuKhiNong', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soLuongNguoiChet', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soNguoiBiThuong', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'coBangNhom', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soBangNhomBatDuoc', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soSungThuHoi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soThuocNoThuHoi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'coVPHC', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongVPHC', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soNguoiBiPhatTien', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tongTienPhatHanhChinh', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soDoiTuongSuuTraHiemNghi', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'coGhiAmGhiHinh', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanGhiLoiKhai', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soBienBanGhiLoiKhaiCoGhiAm', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'laVuAnGhiAmGhiHinh', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanHoiCung', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'tongSoBienBanHoiCungCoGhiAm', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soBiCanCoGhiAm', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'vksYeuCauGhiAm', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'soBiCanVksYeuCauGhiAm', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'vuAnDaDuocXetXu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ghiAmGhiHinhDaDuocXetXu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'coSuDungKQGhiAmTrongXetXu', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'khongGAGHNhungToaYeuCau', loai: 'metadata', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  /*
    BA CỘT RIÊNG — thêm 23/09/2026 sau khi anh báo tệp vẫn còn cột rỗng.

    Đợt trước em CHỈ đo khoá `metadata`, không đo 42 cột riêng: lúc ấy bản sao `pc02_spike`
    thiếu cột mới (`huongXuLy`) nên truy vấn đổ, và em bỏ qua thay vì đo chỗ khác. Nay đo thẳng
    trên prod 47.626 hồ sơ.

    `lanhDaoToTung` ĐÍNH CHÍNH một câu em viết trong chính tệp này: "KHÔNG cắt 6 ô trong nhóm
    gập vì chúng CÓ dữ liệu thật (3.335 hồ sơ có CCCĐ)". Đúng cho 5 ô, SAI cho ô này — nó rỗng
    0/47.626. Em suy từ một ô ra cả nhóm thay vì đo từng ô. Nguyên tắc "gập không phải lý do để
    cắt" vẫn đúng; ô này bị cắt vì RỖNG, một lý do khác hẳn.
  */
  { khoaLuu: 'lanhDaoToTung', loai: 'cot', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'ngayXayRa', loai: 'cot', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
  { khoaLuu: 'noiXayRaPhuongXa', loai: 'cot', lyDo: 'rỗng 0/47.626 hồ sơ (prod)', doNgay: '2026-09-23' },
];
