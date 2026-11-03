import { HuongXuLyDon, PetitionStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import {
  HUONG_XU_LY_LABEL,
  PETITION_STATUS_LABEL,
} from '../../constants/status-labels.constants';

/**
 * Khai trường tìm được của danh sách Đơn thư — NGUỒN DUY NHẤT cho: cột bóng + trigger + chỉ mục
 * (migration sinh ra), field Prisma, và danh sách khoá thẻ phía giao diện (`generated.ts`).
 *
 * Thứ tự = thứ tự cột trên màn danh sách (`PetitionListPageShell.tsx`), để gợi ý thẻ xếp đúng
 * như cán bộ nhìn thấy. Khoá dùng tên CHUẨN liên thực thể (`nguoiGui`, `tomTat`, `donViGiaiQuyet`…)
 * — màn Tổng hợp gửi cùng một khoá tới cả ba API.
 *
 * Thêm một cột tìm được = thêm một dòng ở đây rồi chạy `npm run gen:tim-kiem`; cổng
 * `tim-kiem-sinh-khop.gate.spec.ts` đỏ nếu quên chạy.
 */
export const KHAI_TIM_KIEM_DON_THU: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  refreshExisting: true,
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'stt' },
    { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', cot: 'sttCu' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    {
      key: 'loaiThongTin',
      nhan: 'Loại thông tin',
      kieu: 'chu',
      cot: 'loaiThongTin',
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
      cot: 'senderName',
    },
    {
      key: 'tomTat',
      nhan: 'Tóm tắt nội dung',
      kieu: 'chu',
      cot: 'detailContent',
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
      quanHe: 'enteredBy',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      // Mã trạng thái lạ → 400; để lọt tới Prisma là 500 vì giá trị enum không hợp lệ.
      giaTriHopLe: Object.values(PetitionStatus),
      // Nhãn tiếng Việt cho dòng "tất cả các cột": gõ "đang xử lý" phải ra đúng nhóm hồ sơ ấy.
      // Lấy từ hằng số nhãn dùng chung — chép sang đây là hai bản sẽ trôi khỏi nhau.
      nhanGiaTri: PETITION_STATUS_LABEL,
    },
    {
      key: 'doiTuong',
      nhan: 'Đối tượng bị tố',
      kieu: 'chu',
      cot: 'suspectedPerson',
    },
    // Cột `deadline` RỖNG SẠCH trên dữ liệu thật (đo 21/09/2026: 0/46.741) nên thẻ này hiện
    // khớp 0 hồ sơ. GIỮ vì gỡ khoá thẻ là vỡ đường dẫn đã lưu, và hạn tự tính sẽ điền cột ấy.
    // Global search includes every list date, including bookkeeping dates.
    {
      key: 'hanXuLy',
      nhan: 'Hạn xử lý',
      kieu: 'ngay',
      cot: 'deadline',
      vaoTatCa: true,
    },
    {
      key: 'ngayTao',
      nhan: 'Ngày tạo',
      kieu: 'ngay',
      cot: 'createdAt',
      vaoTatCa: true,
    },
    /*
      Sáu cột ngày ĐẦY DỮ LIỆU mà trước 21/09/2026 không tìm được — đo trên 46.741 đơn thật:
      Ngày tiếp nhận 46.741 · Ngày tiếp nhận nguồn tin 44.367 · Ngày viết đơn 41.820 ·
      Ngày giao đơn vị 25.386 · Ngày phiếu chuyển 9.315 · Ngày cấp CCCD 2.168.

      Mỗi khoá kèm một cột `optional: 'hide'` trên `PetitionListPageShell` để cổng
      `timKiemCotKhai` vẫn xanh MÀ KHÔNG BỊ NỚI, và cán bộ bật được cột để nhìn thấy đúng thứ
      mình vừa tìm.
    */
    {
      key: 'ngayTiepNhan',
      nhan: 'Ngày tiếp nhận',
      kieu: 'ngay',
      cot: 'receivedDate',
    },
    {
      key: 'ngayTiepNhanNguonTin',
      nhan: 'Ngày tiếp nhận nguồn tin',
      kieu: 'ngay',
      cot: 'ngayTiepNhanNguonTin',
    },
    {
      key: 'ngayVietDon',
      nhan: 'Ngày viết đơn',
      kieu: 'ngay',
      cot: 'petitionDate',
      // ~4.4k đơn chỉ có ngày THIẾU thành phần (`2026-12-XX`), cột ngày thật rỗng.
      cotEdtf: 'ngayVietDonEdtf',
    },
    {
      key: 'ngayGiaoDonViGiaiQuyet',
      nhan: 'Ngày giao đơn vị giải quyết',
      kieu: 'ngay',
      cot: 'ngayGiaoDonViGiaiQuyet',
    },
    {
      key: 'ngayPhieuChuyen',
      nhan: 'Ngày phiếu chuyển',
      kieu: 'ngay',
      cot: 'ngayPhieuChuyen',
    },
    {
      key: 'ngayCapCCCD',
      nhan: 'Ngày cấp CCCD',
      kieu: 'ngay',
      cot: 'senderIdIssueDate',
    },
    /*
      Every remaining form field that holds data (added 03/11/2026). The form has 130 fields; only 12 were
      searchable. 88 are empty on production (0 / 47.626, `cot-xuat-day-du.loai-tru.ts`), the other 30 are
      declared here. The gate `form-don-thu-tim-duoc.gate.spec.ts` keeps the two lists complete.

      Each tag ships with an `optional: 'hide'` column on `PetitionListPageShell` (gate `timKiemCotKhai`).
    */
    {
      key: 'soPhieuChuyen',
      nhan: 'Số phiếu chuyển/ Công văn/ Ủy thác điều tra',
      kieu: 'chu',
      cot: 'soPhieuChuyen',
    },
    // The form calls it "Nhận xét" (legacy field `nhanXet`) but on a petition it is stored in `nhanThay`:
    // pointing the tag at `nhanXet` (a `cases` column) would match nothing and never fail.
    { key: 'nhanXet', nhan: 'Nhận xét', kieu: 'chu', cot: 'nhanThay' },
    { key: 'deXuat', nhan: 'Đề xuất xử lý', kieu: 'chu', cot: 'deXuat' },
    {
      key: 'huongXuLy',
      nhan: 'Hướng xử lý',
      kieu: 'chon',
      cot: 'huongXuLy',
      giaTriHopLe: Object.values(HuongXuLyDon),
      nhanGiaTri: HUONG_XU_LY_LABEL,
    },
    {
      key: 'ghiChuTrungDon',
      nhan: 'Ghi chú trùng đơn',
      kieu: 'chu',
      cot: 'raSoatTrung',
    },
    {
      key: 'baoCaoBanGiamDoc',
      nhan: 'Trường hợp báo cáo Ban Giám đốc',
      kieu: 'chu',
      cot: 'baoCaoBanGiamDocText',
    },
    { key: 'ghiChuKhac', nhan: 'Ghi chú khác', kieu: 'chu', cot: 'ghiChuKhac' },
    {
      key: 'phuongThucThuDoan',
      nhan: 'Phương thức thủ đoạn',
      kieu: 'chu',
      cot: 'phuongThucThuDoan',
    },
    {
      key: 'phanLoaiNguonTin',
      nhan: 'Phân loại ban đầu',
      kieu: 'chu',
      cot: 'phanLoaiNguonTin',
    },
    {
      key: 'laCongNgheCao',
      nhan: 'Tội phạm công nghệ cao',
      kieu: 'chon',
      cot: 'laCongNgheCao',
      giaTriCot: { co: true, khong: false },
    },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên thụ lý',
      kieu: 'chu',
      cot: 'dieuTraVien',
    },
    // The person who supplied the information (sender* columns).
    {
      key: 'soDienThoai',
      nhan: 'Số điện thoại nguyên đơn',
      kieu: 'chu',
      cot: 'senderPhone',
    },
    { key: 'namSinh', nhan: 'Sinh năm', kieu: 'chu', cot: 'senderBirthYear' },
    {
      key: 'soCccd',
      nhan: 'Số căn cước công dân',
      kieu: 'chu',
      cot: 'senderIdNumber',
    },
    {
      key: 'noiCapCccd',
      nhan: 'Nơi cấp CCCD',
      kieu: 'chu',
      cot: 'senderIdIssuePlace',
    },
    {
      key: 'diaChi',
      nhan: 'Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      kieu: 'chu',
      cot: 'senderAddress',
    },
    // Source suspension / resumption / assignment decisions.
    {
      key: 'soQDPhanCongNguonTin',
      nhan: 'Quyết định phân công giải quyết nguồn tin tội phạm',
      kieu: 'chu',
      cot: 'soQDPhanCongNguonTin',
    },
    {
      key: 'ngayQDPhanCongNguonTin',
      nhan: 'Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm',
      kieu: 'ngay',
      cot: 'ngayQDPhanCongNguonTin',
    },
    {
      key: 'soQDTamDinhChiNguonTin',
      nhan: 'Quyết định Tạm đình chỉ nguồn tin',
      kieu: 'chu',
      cot: 'soQDTamDinhChiNguonTin',
    },
    {
      key: 'ngayQDTamDinhChiNguonTin',
      nhan: 'Ngày ra Quyết định Tạm đình chỉ nguồn tin',
      kieu: 'ngay',
      cot: 'ngayQDTamDinhChiNguonTin',
    },
    {
      key: 'canCuTamDinhChiNguonTin',
      nhan: 'Căn cứ Tạm đình chỉ nguồn tin',
      kieu: 'chu',
      cot: 'canCuTamDinhChiNguonTin',
    },
    {
      key: 'soPhucHoiNguonTin',
      nhan: 'Số Phục hồi nguồn tin tội phạm',
      kieu: 'chu',
      cot: 'soPhucHoiNguonTin',
    },
    {
      key: 'ngayPhucHoiNguonTin',
      nhan: 'Ngày Phục hồi nguồn tin tội phạm',
      kieu: 'ngay',
      cot: 'ngayPhucHoiNguonTin',
    },
    {
      key: 'thoiHanUTDT',
      nhan: 'Thời hạn thực hiện Uỷ thác điều tra',
      kieu: 'ngay',
      cot: 'thoiHanUTDT',
    },
    // Initial crime classification: same relation tag as Vụ việc / Vụ án, so the combined list shares the key.
    {
      key: 'toiDanhChinh',
      nhan: 'Tội danh chính - BLHS 2015 (nhận định ban đầu)',
      kieu: 'quan-he',
      quanHe: 'crimeChinh',
      modelDich: 'Crime',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    // Numbers: equality only, never reachable from the "all columns" box.
    {
      key: 'soTienBiThietHai',
      nhan: 'Số tiền bị thiệt hại (triệu Việt nam Đồng)',
      kieu: 'so',
      cot: 'soTienBiThietHai',
    },
    {
      key: 'soLuongBiHai',
      nhan: 'Số lượng người bị hại',
      kieu: 'so',
      cot: 'soLuongBiHai',
      soNguyen: true,
    },
    /*
      Prosecution decision fields: a petition has no column for them, the form keeps them in `metadata`.
      `cot` is a virtual name for the shadow column (not in schema.prisma). Measured on production
      (29/09/2026, see `cot-xuat-day-du.loai-tru.ts`): these three are the only `metadata` keys that hold data.
    */
    {
      key: 'soQuyetDinhKhoiTo',
      nhan: 'Số Quyết định Khởi tố vụ án',
      kieu: 'chu',
      cot: 'soQuyetDinhKhoiTo',
      nguonJson: { cot: 'metadata', khoa: 'soQuyetDinhKhoiTo' },
    },
    {
      key: 'ngayKhoiTo',
      nhan: 'Ngày ra Quyết định Khởi tố vụ án',
      kieu: 'ngay',
      cot: 'ngayKhoiTo',
      nguonJson: { cot: 'metadata', khoa: 'ngayKhoiTo' },
    },
    {
      key: 'toiDanhChinhKhoiTo',
      nhan: 'Tội danh chính khi khởi tố',
      kieu: 'chu',
      cot: 'toiDanhChinhKhoiTo',
      // The form stores the crime ID; the shadow keeps the crime NAME so typing a name finds it.
      nguonJson: {
        cot: 'metadata',
        khoa: 'toiDanhChinhKhoiToId',
        tuBang: { bang: 'crimes', cot: 'name' },
      },
    },
  ],
  tatCaGomQuanHe: ['toiDanhChinh'],
  // Preserve legacy identifiers and the free-text value rendered by the petition date column.
  cotThemVaoTatCa: [
    'soHoSoCu',
    { cot: 'ngayVietDonChu', cotDb: 'ngay_viet_don_chu' },
  ],
};
