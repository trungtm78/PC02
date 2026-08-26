/**
 * Bảng buộc bố cục hệ cũ vào dữ liệu form Đơn thư.
 *
 * Hệ cũ dùng ĐÚNG MỘT form `/doi-1/Them` cho cả Đơn thư, Vụ việc và Vụ án — cùng 10 tab, cùng
 * 231 nhãn, cùng thứ tự. Đặc tả bố cục ấy đã có ở `features/cases/legacy-form-layout.def.ts`,
 * chụp thẳng từ DOM hệ cũ. Chép nội dung sang tệp thứ hai là mở đường cho hai màn trôi khỏi
 * nhau, nên ở đây chỉ khai CHỖ LƯU — nhãn, thứ tự, chỗ đứng vẫn lấy từ đặc tả gốc.
 *
 * Ba loại đích:
 *
 *   1. Khoá `PetitionFormData` trùng tên — Đơn thư và Vụ án gọi cùng một thứ.
 *   2. Khoá `PetitionFormData` KHÁC tên — cùng nghĩa, khác cách gọi (`tenCungCap` của Vụ án là
 *      `senderName` của Đơn thư). Đây là phần đông.
 *   3. `legacyExtra.<khoá>` — ô của giai đoạn khởi tố / tạm đình chỉ vụ án mà Đơn thư không có
 *      cột. Cán bộ vẫn thấy ô đúng chỗ như hệ cũ, giá trị vẫn lưu, chỉ là lưu ở `metadata`.
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
import type { PetitionFormData } from '@/pages/petitions/PetitionFormPage/types';

/** Nhánh lồng giữ ô hệ cũ chưa có cột riêng trên Đơn thư. */
const NHANH_PHU = 'legacyExtra' as const;

export type PetitionFieldPath = keyof PetitionFormData | `${typeof NHANH_PHU}.${string}`;

/**
 * Ô có chỗ lưu THẬT trên Đơn thư — cột riêng, tên trùng hoặc khác.
 *
 * Ô nào không có tên ở đây thì tự động về `legacyExtra.<tên ô của Vụ án>`.
 */
const CO_COT_RIENG: Readonly<Partial<Record<CaseFieldPath, keyof PetitionFormData>>> = {
  // Tab Thông tin — phần tiếp nhận, trùng nghĩa nhưng Đơn thư gọi khác
  ngayDeXuat: 'ngayDeXuat',
  phanLoaiNguonTinBanDau: 'phanLoaiNguonTin',
  nguonDon: 'nguonDon',
  loaiThongTin: 'loaiThongTin',
  soPhieuChuyen: 'soPhieuChuyen',
  ngayPhieuChuyen: 'ngayPhieuChuyen',
  ngayTiepNhanNguonTin: 'ngayTiepNhanNguonTin',
  tenCungCap: 'senderName',
  sdtCungCap: 'senderPhone',
  sinhNamCungCap: 'senderBirthYear',
  cccdCungCap: 'senderIdNumber',
  ngayCapCccd: 'senderIdIssueDate',
  noiCapCccd: 'senderIdIssuePlace',
  diaChiCungCap: 'senderAddress',
  nghiVanDoiTuong: 'suspectedPerson',
  toiDanhBanDau: 'toiDanhBanDau',
  crimeChinhId: 'crimeChinhId',
  noiXayRa: 'noiXayRa',
  utdt_thoiHanUyThac: 'thoiHanUTDT',
  description: 'detailContent',
  doVatTaiLieuKemTheo: 'attachmentsNote',
  ngayVietDon: 'petitionDate',
  nhanXet: 'nhanThay',
  ghiChuTrungDon: 'raSoatTrung',
  baoCaoBanGiamDoc: 'baoCaoBanGiamDocText',
  supervisingUnit: 'unit',
  ngayGiaoDonViGiaiQuyet: 'ngayGiaoDonViGiaiQuyet',
  laCongNgheCao: 'laCongNgheCao',
  dieuTraVienText: 'dieuTraVien',
  lanhDaoToTung: 'lanhDaoToTung',
  ketQuaXuLyKhac: 'ketQuaXuLyKhac',
  ghiChuKhac: 'ghiChuKhac',

  // Cột thêm 26/08/2026 cho ô hệ cũ còn kẹt
  soQDPhanCongNguonTin: 'soQDPhanCongNguonTin',
  ngayQDPhanCongNguonTin: 'ngayQDPhanCongNguonTin',
  soQDTamDinhChiNguonTin: 'soQDTamDinhChiNguonTin',
  ngayQDTamDinhChiNguonTin: 'ngayQDTamDinhChiNguonTin',
  canCuTamDinhChiNguonTin: 'canCuTamDinhChiNguonTin',
  soPhucHoiNguonTin: 'soPhucHoiNguonTin',
  ngayPhucHoiNguonTin: 'ngayPhucHoiNguonTin',

  // Tab TK 48 trường — phần Đơn thư có cột
  ngayXayRa: 'ngayXayRa',
  noiXayRaPhuongXa: 'noiXayRaPhuongXa',
  phuongThucThuDoan: 'phuongThucThuDoan',
  'statistic.soTienBiThietHai': 'soTienBiThietHai',
  'statistic.soLuongBiHai': 'soLuongBiHai',
};

/** Đích lưu của một ô: cột riêng nếu có, không thì về nhánh phụ. */
export function dichLuu(field: CaseFieldPath): PetitionFieldPath {
  const cot = CO_COT_RIENG[field];
  if (cot) return cot;
  // Ô của nhánh `statistic.` bên Vụ án: Đơn thư không có bảng thống kê, giữ nguyên tên khoá
  // để đối chiếu được với hệ cũ.
  return `${NHANH_PHU}.${field.replace('statistic.', '')}`;
}

function doiTab(
  items: readonly LegacyLayoutItem<CaseFieldPath, LegacyTabId>[],
): readonly LegacyLayoutItem<PetitionFieldPath, LegacyTabId>[] {
  return items.map((it) => ({ ...it, field: dichLuu(it.field) }));
}

export const PETITION_LEGACY_LAYOUT: LegacyLayout<LegacyTabId, PetitionFieldPath> =
  Object.fromEntries(
    Object.entries(LEGACY_FORM_LAYOUT).map(([tab, items]) => [
      tab,
      doiTab(items as readonly LegacyLayoutItem<CaseFieldPath, LegacyTabId>[]),
    ]),
  ) as LegacyLayout<LegacyTabId, PetitionFieldPath>;

const O_PHU = nestedAccessor<PetitionFormData, typeof NHANH_PHU>(NHANH_PHU);

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
  Object.values(PETITION_LEGACY_LAYOUT)
    .flat()
    .map((it) => it.field)
    .filter((f) => f.startsWith(`${NHANH_PHU}.`))
    .map((f) => f.slice(NHANH_PHU.length + 1)),
);

export const PETITION_LEGACY_SPEC: LegacyFormSpec<
  PetitionFormData,
  LegacyTabId,
  PetitionFieldPath
> = {
  entity: 'petition',
  tabLabel: LEGACY_TAB_LABEL,
  layout: PETITION_LEGACY_LAYOUT,
  read: (form, field) => O_PHU.read(form, field),
  write: (form, field, value) => O_PHU.write(form, field, value),
  fieldToColumn: O_VOI_COT,
};
