/**
 * Bảng buộc bố cục hệ cũ vào dữ liệu form Vụ việc.
 *
 * Hệ cũ dùng ĐÚNG MỘT form `/doi-1/Them` cho cả Đơn thư, Vụ việc và Vụ án — cùng 10 tab, cùng
 * bộ nhãn, cùng thứ tự. Đo lại ngày 27/08/2026: nút "Thêm mới" trên màn
 * `/doi-1/vu-viec-da-phan-loai` trỏ thẳng tới `/doi-1/Them`, và một vụ việc thật dùng cả 10
 * tab chứ không riêng tab Thông tin.
 *
 * Đặc tả bố cục ấy đã có ở `features/cases/legacy-form-layout.def.ts`, chụp thẳng từ DOM hệ
 * cũ. Chép nội dung sang tệp thứ ba là mở đường cho ba màn trôi khỏi nhau, nên ở đây chỉ khai
 * CHỖ LƯU — nhãn, thứ tự, chỗ đứng vẫn lấy từ đặc tả gốc.
 *
 * Ba loại đích:
 *
 *   1. Khoá `IncidentFormData` trùng tên — Vụ việc và Vụ án gọi cùng một thứ.
 *   2. Khoá `IncidentFormData` KHÁC tên — cùng nghĩa, khác cách gọi. Bảng đổi tên dưới đây
 *      KHÔNG suy từ tên cột mà tra từ chính bộ di trú (`buildIncident` trong
 *      `legacy-mapper.ts`): cột nào nhận khoá hệ cũ nào là dữ kiện, không phải phỏng đoán.
 *   3. `legacyExtra.<khoá>` — ô của giai đoạn khởi tố / vụ án mà Vụ việc không có cột. Cán bộ
 *      vẫn thấy ô đúng chỗ như hệ cũ, giá trị vẫn lưu, chỉ là lưu ở `metadata`.
 *
 * Không ô nào được rơi: cổng `moiOCoChoLuu` bắt mọi ô thiếu đích.
 */
import {
  LEGACY_FORM_LAYOUT,
  LEGACY_TAB_LABEL,
  type CaseFieldPath,
  type LegacyTabId,
} from '@/features/cases/legacy-form-layout.def';
import { nestedAccessor } from '@/features/legacy-form/accessors';
import type {
  LegacyFormSpec,
  LegacyLayout,
  LegacyLayoutItem,
} from '@/features/legacy-form/types';
import type { IncidentFormData } from '@/pages/incidents/incident-form.types';

/** Nhánh lồng giữ ô hệ cũ chưa có cột riêng trên Vụ việc. */
const NHANH_PHU = 'legacyExtra' as const;

export type IncidentFieldPath = keyof IncidentFormData | `${typeof NHANH_PHU}.${string}`;

/**
 * Ô có chỗ lưu THẬT trên Vụ việc — cột riêng, tên trùng hoặc khác.
 *
 * Ô nào không có tên ở đây thì tự động về `legacyExtra.<tên ô của Vụ án>`.
 *
 * Phần ĐỔI TÊN tra từ `buildIncident`: ví dụ hệ cũ ghi tên người cung cấp ở
 * `ten_ca_nhan_co_quan_to_chuc_cung_cap`, và bộ di trú đổ khoá ấy vào cột `benVu` — nên ô
 * "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" của bố cục phải trỏ `benVu`, không phải
 * một cột nghe giống tên.
 */
const CO_COT_RIENG: Readonly<Partial<Record<CaseFieldPath, keyof IncidentFormData>>> = {
  // ── Trùng tên ────────────────────────────────────────────────────────────────────────
  ngayDeXuat: 'ngayDeXuat',
  description: 'description',
  lanhDaoToTung: 'lanhDaoToTung',
  phanLoaiNguonTinBanDau: 'phanLoaiNguonTinBanDau',
  loaiThongTin: 'loaiThongTin',
  soPhieuChuyen: 'soPhieuChuyen',
  ngayPhieuChuyen: 'ngayPhieuChuyen',
  ngayTiepNhanNguonTin: 'ngayTiepNhanNguonTin',
  ngayCapCccd: 'ngayCapCccd',
  noiCapCccd: 'noiCapCccd',
  toiDanhBanDau: 'toiDanhBanDau',
  crimeChinhId: 'crimeChinhId',
  doVatTaiLieuKemTheo: 'doVatTaiLieuKemTheo',
  ngayVietDon: 'ngayVietDon',
  nhanXet: 'nhanXet',
  ghiChuTrungDon: 'ghiChuTrungDon',
  baoCaoBanGiamDoc: 'baoCaoBanGiamDocText',
  ngayGiaoDonViGiaiQuyet: 'ngayGiaoDonViGiaiQuyet',
  ghiChuKhac: 'ghiChuKhac',
  soQDPhanCongNguonTin: 'soQDPhanCongNguonTin',
  ngayQDPhanCongNguonTin: 'ngayQDPhanCongNguonTin',
  soQDKhongKhoiTo: 'soQDKhongKhoiTo',
  ngayQDKhongKhoiTo: 'ngayQDKhongKhoiTo',
  canCuKhongKhoiTo: 'canCuKhongKhoiTo',
  lyDoKhongKhoiTo: 'lyDoKhongKhoiTo',
  tdcKhacPhucBienBan: 'tdcKhacPhucBienBan',
  tdcKhacPhucLyDoBienPhap: 'tdcKhacPhucLyDoBienPhap',

  // ── Đổi tên, tra từ `buildIncident` ──────────────────────────────────────────────────
  nguonDon: 'chuyenTuDonVi', // nguon_don
  tenCungCap: 'benVu', // ten_ca_nhan_co_quan_to_chuc_cung_cap
  sdtCungCap: 'sdtNguoiToGiac', // so_dien_thoai_nguyen_don
  sinhNamCungCap: 'sinhNamNguoiToGiac', // sinh_nam_nguoi_to_giac
  cccdCungCap: 'cmndNguoiToGiac', // so_cccd_nguyen_don
  diaChiCungCap: 'diaChiNguoiToGiac', // dia-chi-bi-hai
  nghiVanDoiTuong: 'doiTuongCaNhan', // nghi_van_doi_tuong
  noiXayRa: 'diaChiXayRa', // noi_xay_ra
  supervisingUnit: 'donViGiaiQuyet', // don_vi_giai_quyet
  ketQuaXuLyKhac: 'ketQuaXuLy', // ket_qua_xu_ly_giai_quyet_khac
  dieuTraVienText: 'dieuTraVien',
  laCongNgheCao: 'laCongNgheCaoVV',
  phanLoaiDanSu: 'phanLoaiDanSuText', // phan_loai_dan_su
  chuyenVuViecDonViKhac: 'chuyenDenDonVi', // vu_viec_chuyen_don_vi_khac
  vuViecTamDungTruoc2015: 'xacDinhVuViecTamDung',
  soQDTamDinhChiNguonTin: 'soQuyetDinhTamDinhChiVV', // quyet_dinh_tam_dinh_chi_nguon_tin
  ngayQDTamDinhChiNguonTin: 'ngayTamDinhChiVV', // ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin
  canCuTamDinhChiNguonTin: 'canCuTamDinhChi', // can_cu_tam_dinh_chi_nguon_tin
  soPhucHoiNguonTin: 'soQuyetDinhPhucHoiVV', // phuc_hoi_nguon_tin_toi_pham
  ngayPhucHoiNguonTin: 'ngayPhucHoiVV', // ngay_phuc_hoi_nguon_tin_toi_pham
  ngayHetThoiHieuVuViec: 'ngayHetThoiHieuVV', // ngay_thang_nam_het_thoi_hieu_vu_viec
  tienDoKhacPhucTDCVuViec: 'tienDoKhacPhucTDC', // tien_do_khac_phuc_tdc
  lyDoTamDinhChiNguonTin: 'lyDoTamDinhChiVuViec',
};

/** Đích lưu của một ô: cột riêng nếu có, không thì về nhánh phụ. */
export function dichLuu(field: CaseFieldPath): IncidentFieldPath {
  const cot = CO_COT_RIENG[field];
  if (cot) return cot;
  // Ô của nhánh `statistic.` bên Vụ án: Vụ việc không có bảng thống kê, giữ nguyên tên khoá
  // để đối chiếu được với hệ cũ.
  return `${NHANH_PHU}.${field.replace('statistic.', '')}`;
}

function doiTab(
  items: readonly LegacyLayoutItem<CaseFieldPath, LegacyTabId>[],
): readonly LegacyLayoutItem<IncidentFieldPath, LegacyTabId>[] {
  return items.map((it) => ({ ...it, field: dichLuu(it.field) }));
}

export const INCIDENT_LEGACY_LAYOUT: LegacyLayout<LegacyTabId, IncidentFieldPath> =
  Object.fromEntries(
    Object.entries(LEGACY_FORM_LAYOUT).map(([tab, items]) => [
      tab,
      doiTab(items as readonly LegacyLayoutItem<CaseFieldPath, LegacyTabId>[]),
    ]),
  ) as LegacyLayout<LegacyTabId, IncidentFieldPath>;

const O_PHU = nestedAccessor<IncidentFormData, typeof NHANH_PHU>(NHANH_PHU);

/**
 * Bảng đổi ô-với-cột cho panel "Thông tin nghiệp vụ bổ sung".
 *
 * Ô nào đã có chỗ trong tab thì panel KHÔNG được dựng ô thứ hai — panel gộp vào payload sau
 * form nên nó thắng, và cán bộ mất thứ vừa gõ.
 */
const O_VOI_COT: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(CO_COT_RIENG).map((cot) => [cot, cot]),
);

/**
 * Khoá metadata mà BỐ CỤC HỆ CŨ đã có ô nhập.
 *
 * Dùng để tách đôi phần metadata đọc về: khoá nào có ô trong tab thì thuộc `legacyExtra`,
 * còn lại để `metaState` cho panel động. Không tách thì hai vùng cùng giữ một khoá, và lúc
 * gộp lại vùng nào ghi sau sẽ đè vùng kia — cán bộ sửa ở panel động, bấm Lưu, không đổi gì.
 */
export const KHOA_NHANH_PHU: ReadonlySet<string> = new Set(
  Object.values(INCIDENT_LEGACY_LAYOUT)
    .flat()
    .map((it) => it.field)
    .filter((f) => f.startsWith(`${NHANH_PHU}.`))
    .map((f) => f.slice(NHANH_PHU.length + 1)),
);

export const INCIDENT_LEGACY_SPEC: LegacyFormSpec<
  IncidentFormData,
  LegacyTabId,
  IncidentFieldPath
> = {
  entity: 'incident',
  tabLabel: LEGACY_TAB_LABEL,
  layout: INCIDENT_LEGACY_LAYOUT,
  read: (form, field) => O_PHU.read(form, field),
  write: (form, field, value) => {
    const sau = O_PHU.write(form, field, value);
    // Ô "Tóm tắt nội dung" là ô nội dung DUY NHẤT cán bộ nhìn thấy, nhưng máy chủ giữ hai cột:
    // `description` và `name` (bắt buộc, ≥5 ký tự). Đo trên máy chạy 27/08/2026: 4.598/4.717
    // hồ sơ (97,5%) đã có hai cột trùng y hệt nhau.
    //
    // Đồng bộ theo lối SOI GƯƠNG, không đè: chỉ cập nhật `name` khi nó đang trống hoặc còn
    // khớp giá trị cũ của `description`. 119 hồ sơ có tên riêng khác tóm tắt — đè lên nghĩa là
    // cán bộ mở hồ sơ ra, không sửa gì, bấm Lưu, và hồ sơ bị đổi tên mà không ai biết.
    if (field === 'description') {
      const soiGuong = !form.name || form.name === form.description;
      if (soiGuong) return { ...sau, name: String(value ?? '') };
    }
    return sau;
  },
  fieldToColumn: O_VOI_COT,
};
