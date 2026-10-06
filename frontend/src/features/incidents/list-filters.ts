import { createListFilterRegistry } from "@/features/_shared/list-filters/registry";

/**
 * v0.64 PR2 — Incidents advanced filter fields registration.
 *
 * Mirrors legacy IncidentListPage.tsx (commit 2cbdd90^):
 *   keyword, loaiDonVu (TO_GIAC | TIN_BAO | KIEN_NGHI_KHOI_TO), reporter, đơn vị.
 *
 * Phase tabs (Tiếp nhận / Xác minh / Kết quả / Tạm đình chỉ) handled by shell
 * separately via existing phaseFilter URL state.
 *
 * 15/09/2026: các ô lọc CHỮ theo cột (Đơn vị, STT, STT cũ) chuyển sang ô tìm kiếm dạng thẻ — khoá
 * thẻ khai ở `backend/src/common/tim-kiem/khai/vu-viec.khai.ts`. Đường dẫn cũ `incidents_unit=`…
 * vẫn mở ra thẻ tương ứng (`THAM_SO_CU_VU_VIEC` ở IncidentListPageShell). `reporter` Ở LẠI: nó tra
 * CCCD/SĐT người tố giác, không cột nào trên danh sách mang nó nên không thành thẻ được.
 *
 * See docs/audit/shell-parity-matrix.md Incidents section.
 */

export interface IncidentFilterValue {
  tinhTrangHoSo?: string;
  tinhTrangThoiHieu?: string;
  emptyField?: string;
  historyStatus?: string;
  intakeStage?: string;
  keyword?: string;
  loaiDonVu?: string;
  reporter?: string;
  canBoNhapId?: string;
  fromDateRange?: string;
  toDateRange?: string;
  /** Tạm đổi kỳ thống kê tính theo ngày nào; rỗng = theo cấu hình hệ thống. */
  thongKeTruongNgay?: string;
}

const incidents = createListFilterRegistry<IncidentFilterValue>();

incidents.registerMany([
  {
    key: "tinhTrangHoSo",
    label: "Tình trạng hồ sơ",
    type: "text",
    urlKey: "tinh_trang_ho_so",
    testid: "filter-tinh-trang-ho-so",
  },
  {
    key: "tinhTrangThoiHieu",
    label: "Tình trạng thời hiệu",
    type: "text",
    urlKey: "tinh_trang_thoi_hieu",
    testid: "filter-thoi-hieu",
  },
  {
    key: "intakeStage",
    label: "Bàn giao",
    type: "enumSelect",
    urlKey: "intake_stage",
    testid: "filter-intake-stage",
    options: [
      { value: "PHAN_LOAI", label: "Tiếp nhận / Phân loại" },
      { value: "CHO_NHAN", label: "Chờ nhận" },
      { value: "DA_NHAN", label: "Đã nhận" },
    ],
  },
  {
    key: "emptyField",
    label: "Tìm trường bỏ trống",
    type: "enumSelect",
    urlKey: "empty_field",
    testid: "filter-empty-field",
    options: [
      { value: "ngayTiepNhanNguonTin", label: "Ngày tiếp nhận nguồn tin" },
      { value: "soQDPhanCongNguonTin", label: "Số QĐ phân công" },
      { value: "soQuyetDinhTamDinhChiVV", label: "Số QĐ tạm đình chỉ" },
      { value: "soQuyetDinhPhucHoiVV", label: "Số QĐ phục hồi" },
      { value: "benVu", label: "Người cung cấp / bị hại" },
      { value: "donViGiaiQuyet", label: "Đơn vị giải quyết" },
      { value: "crimeChinhId", label: "Tội danh nhận định" },
    ],
  },
  {
    key: "historyStatus",
    label: "Đã từng thực hiện",
    type: "enumSelect",
    urlKey: "history_status",
    testid: "filter-history-status",
    options: [
      { value: "TAM_DINH_CHI", label: "Tạm đình chỉ" },
      { value: "PHUC_HOI_NGUON_TIN", label: "Phục hồi nguồn tin" },
      { value: "KHONG_KHOI_TO", label: "Không khởi tố" },
      { value: "DA_CHUYEN_VU_AN", label: "Khởi tố thành vụ án" },
      { value: "DA_NHAP_VU_KHAC", label: "Nhập vụ việc khác" },
      { value: "DA_CHUYEN_DON_VI", label: "Chuyển đơn vị" },
      { value: "DA_PHAN_CONG", label: "Phân công nguồn tin" },
    ],
  },
  // ĐÃ GỠ field 'keyword': trùng chức năng với ô tìm kiếm trên thanh công cụ (cùng tra
  // mã/tên), và param `keyword` không có trong QueryIncidentsDto nên đang trả 400.
  {
    key: "loaiDonVu",
    label: "Loại nguồn tin",
    type: "enumSelect",
    urlKey: "loai_don_vu",
    testid: "filter-loai-don-vu",
    options: [
      { value: "TO_GIAC", label: "Tố giác" },
      { value: "TIN_BAO", label: "Tin báo" },
      { value: "KIEN_NGHI_KHOI_TO", label: "Kiến nghị khởi tố" },
    ],
  },
  {
    key: "reporter",
    label: "Người tố giác/báo tin",
    type: "text",
    urlKey: "reporter",
    testid: "filter-reporter",
    // Nhãn cũ ghi "Tên hoặc CCCD" là SAI: schema Incident không có cột tên người tố giác
    // (chỉ cmndNguoiToGiac / sdtNguoiToGiac / diaChiNguoiToGiac).
    placeholder: "CCCD hoặc số điện thoại",
  },
  {
    key: "fromDateRange",
    label: "Từ ngày",
    type: "date",
    urlKey: "from_date",
    testid: "filter-from-date",
  },
  {
    key: "toDateRange",
    label: "Đến ngày",
    type: "date",
    urlKey: "to_date",
    testid: "filter-to-date",
  },
  // ── Bổ sung theo bảng lọc hệ cũ (25/08/2026) ─────────────────────────────
  // Khai VÀO ĐÂY chứ không dựng mặt lọc riêng: hai mặt lọc trên một màn hình thì không có
  // cách nào đúng để trả lời "ô nào đang có hiệu lực" — đúng lỗi đã mắc và phải gỡ.
  {
    key: "canBoNhapId",
    label: "Cán bộ nhập",
    type: "enumSelect",
    urlKey: "can_bo_nhap",
    testid: "filter-can-bo-nhap",
  },
  {
    key: "thongKeTruongNgay",
    label: "Tính theo",
    type: "enumSelect",
    urlKey: "tinh_theo",
    testid: "filter-tinh-theo",
    options: [
      { value: "", label: "Theo cấu hình hệ thống" },
      { value: "NGAY_TIEP_NHAN", label: "Ngày tiếp nhận" },
      { value: "NGAY_TAO", label: "Ngày tạo" },
    ],
  },
]);

export const incidentsListFilters = incidents;
