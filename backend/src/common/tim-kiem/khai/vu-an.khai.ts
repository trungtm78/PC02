import { CaseStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import { CASE_STATUS_LABEL } from '../../constants/status-labels.constants';

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
      // Nhãn tiếng Việt cho dòng "tất cả các cột": gõ "đang điều tra" phải ra đúng nhóm hồ sơ ấy.
      // Lấy từ hằng số nhãn dùng chung — chép sang đây là hai bản sẽ trôi khỏi nhau.
      nhanGiaTri: CASE_STATUS_LABEL,
    },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên',
      kieu: 'nguoi',
      quanHe: 'investigator',
    },
    /* Như Đơn thư: dấu thời gian di trú dùng chung. */
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt', vaoTatCa: false },
    /*
      Cột ngày CÓ dữ liệu mà trước 21/09/2026 không tìm được — đo trên 3.381 vụ án thật:
      Ngày nhận 3.339 · Ngày phiếu chuyển 1.717 · Ngày khởi tố 787 · Ngày viết đơn 338 ·
      Ngày cấp CCCD 219. (`ngayTiepNhan` và `thoiHanUyThac` đã tìm được từ trước.)
    */
    { key: 'ngayNhan', nhan: 'Ngày nhận', kieu: 'ngay', cot: 'receiveDate' },
    {
      key: 'ngayPhieuChuyen',
      nhan: 'Ngày phiếu chuyển',
      kieu: 'ngay',
      cot: 'ngayPhieuChuyen',
    },
    { key: 'ngayKhoiTo', nhan: 'Ngày khởi tố', kieu: 'ngay', cot: 'ngayKhoiTo' },
    { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay', cot: 'ngayVietDon' },
    { key: 'ngayCapCCCD', nhan: 'Ngày cấp CCCD', kieu: 'ngay', cot: 'ngayCapCccd' },
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
    // Tội danh chọn từ danh mục BLHS — màn Vụ án phường/xã hiện cột này (344/368 hồ sơ, ô chữ
    // `crime` chỉ 36/368). Cột bóng đích do khai Tội danh sinh.
    {
      key: 'toiDanhChinh',
      nhan: 'Tội danh chính',
      kieu: 'quan-he',
      quanHe: 'crimeChinh',
      modelDich: 'Crime',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    {
      key: 'thoiHan',
      nhan: 'Thời hạn',
      kieu: 'ngay',
      cot: 'thoiHanUyThac',
    },
    // CUỐI danh sách có chủ ý: `name` trước đây đứng đầu `cotThemVaoTatCa`, nên đặt ở đây thì cột ghép
    // "tất cả các cột" giữ nguyên thứ tự cũ — không phải nạp lại `tim_kiem_bd` của 3.418 vụ án.
    { key: 'tenVuAn', nhan: 'Tên vụ án', kieu: 'chu', cot: 'name' },
  ],
  // Ô tìm cũ tìm cả số hồ sơ hệ cũ — thẻ "tất cả các cột" phải tìm được đủ (tên vụ án đã là trường
  // `tenVuAn` ở trên). `unit` rỗng ở toàn bộ vụ án nên không đưa vào.
  cotThemVaoTatCa: ['soHoSoCu'],
  // Tên tội danh chính và tên bị can đang HIỆN trên cột (Vụ án, Vụ án phường/xã) nhưng nằm ở bảng khác —
  // "*" gõ "giết người" phải ra (tội danh chính 344/368 hồ sơ tổ phường, ô chữ `crime` chỉ 36).
  tatCaGomQuanHe: ['toiDanhChinh', 'doiTuongBiCan'],
  // Đích của thẻ "Vụ án" ở Đối tượng/Luật sư: cột ấy hiện TÊN vụ án, lọc phải đúng tên chứ không
  // phải `tim_kiem_bd` (ghép cả mô tả, đơn vị…).
  cotBongPhu: ['name'],
};
