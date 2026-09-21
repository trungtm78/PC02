import { IncidentStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import { INCIDENT_STATUS_LABEL } from '../../constants/status-labels.constants';

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
      // Nhãn tiếng Việt cho dòng "tất cả các cột": gõ "tạm đình chỉ" phải ra đúng nhóm hồ sơ ấy.
      // Lấy từ hằng số nhãn dùng chung — chép sang đây là hai bản sẽ trôi khỏi nhau.
      nhanGiaTri: INCIDENT_STATUS_LABEL,
    },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên',
      kieu: 'nguoi',
      quanHe: 'investigator',
    },
    /* Như Đơn thư: hạn xử lý là ngày phải làm xong, không phải ngày của sự việc. */
    { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay', cot: 'deadline', vaoTatCa: false },
    /* Như Đơn thư: dấu thời gian di trú dùng chung. */
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt', vaoTatCa: false },
    /*
      Cột ngày CÓ dữ liệu mà trước 21/09/2026 không tìm được — đo trên 4.718 vụ việc thật:
      Ngày tiếp nhận nguồn tin 3.039 · Ngày QĐ phân công 474 · Ngày giao đơn vị 365 ·
      Ngày viết đơn 298 · Ngày phiếu chuyển 86 · Ngày cấp CCCD 37.

      Danh sách này ĐO RIÊNG, không chép của Đơn thư: phân bố hai màn khác hẳn nhau.
    */
    {
      key: 'ngayTiepNhanNguonTin',
      nhan: 'Ngày tiếp nhận nguồn tin',
      kieu: 'ngay',
      cot: 'ngayTiepNhanNguonTin',
    },
    {
      key: 'ngayQDPhanCongNguonTin',
      nhan: 'Ngày QĐ phân công nguồn tin',
      kieu: 'ngay',
      cot: 'ngayQDPhanCongNguonTin',
    },
    {
      key: 'ngayGiaoDonViGiaiQuyet',
      nhan: 'Ngày giao đơn vị giải quyết',
      kieu: 'ngay',
      cot: 'ngayGiaoDonViGiaiQuyet',
    },
    { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay', cot: 'ngayVietDon' },
    {
      key: 'ngayPhieuChuyen',
      nhan: 'Ngày phiếu chuyển',
      kieu: 'ngay',
      cot: 'ngayPhieuChuyen',
    },
    { key: 'ngayCapCCCD', nhan: 'Ngày cấp CCCD', kieu: 'ngay', cot: 'ngayCapCccd' },
    // Màn Vụ việc phường/xã hiện tội danh chính (prod 17/09: 1.009/1.165 vụ việc tổ phường). Cột bóng
    // đích do khai Tội danh sinh.
    {
      key: 'toiDanhChinh',
      nhan: 'Tội danh chính',
      kieu: 'quan-he',
      quanHe: 'crimeChinh',
      modelDich: 'Crime',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    // CUỐI danh sách có chủ ý: `name` trước đây đứng đầu `cotThemVaoTatCa`, nên đặt ở đây thì cột ghép
    // "tất cả các cột" giữ nguyên thứ tự cũ — không phải nạp lại `tim_kiem_bd` của 4.725 vụ việc.
    { key: 'tenVuViec', nhan: 'Tên vụ việc', kieu: 'chu', cot: 'name' },
  ],
  // Ô tìm cũ tìm cả đối tượng bị tố giác (cá nhân/tổ chức) và số hồ sơ hệ cũ — thẻ "tất cả các cột"
  // phải tìm được đủ (tên vụ việc đã là trường `tenVuViec` ở trên).
  cotThemVaoTatCa: ['doiTuongCaNhan', 'doiTuongToChuc', 'soHoSoCu'],
  // Tên tội danh chính đang HIỆN trên cột (Vụ việc phường/xã) nhưng nằm ở bảng `crimes`.
  tatCaGomQuanHe: ['toiDanhChinh'],
  // Đích của thẻ "Vụ việc" ở màn Tài liệu: cột ấy hiện TÊN vụ việc, lọc phải đúng tên chứ không phải
  // `tim_kiem_bd` (ghép cả mô tả, đơn vị…).
  cotBongPhu: ['name'],
};
