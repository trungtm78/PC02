import { WardAssignmentKind, WardCaseType } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * The searchable fields of `ward_assignments` — the list "Hồ sơ phân công Công an cấp phường/xã"
 * (`WardAssignmentListPage`), by the columns of that screen: Mã, Ngày trình, Loại hồ sơ, Phân công, Tội danh
 * (catalogue and free text), Trích yếu, Tình trạng, Hạn báo kết quả, and the optional Nơi xảy ra, Cán bộ nhập.
 *
 * "Tình trạng" is not a tag: the six cards are the one control of the status (a tag beside them would be a second
 * writer of the same state, and a card chosen under another status' tag shows nothing).
 *
 * "Đơn vị" is not a tag: it is chosen in the filter panel by its id (a team's name has no shadow column, and the
 * unit is one of a short list).
 */
export const KHAI_TIM_KIEM_HO_SO_PHAN_CONG: KhaiThucThe = {
  thucThe: 'ho-so-phan-cong',
  bang: 'ward_assignments',
  model: 'WardAssignment',
  // "Every column" reads the crime of the catalogue too: it is what the Tội danh column shows.
  tatCaGomQuanHe: ['toiDanh'],
  truong: [
    { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'code' },
    { key: 'trichYeu', nhan: 'Trích yếu', kieu: 'chu', cot: 'summary' },
    {
      key: 'toiDanh',
      nhan: 'Tội danh',
      kieu: 'quan-he',
      quanHe: 'crime',
      modelDich: 'Crime',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    { key: 'toiDanhKhac', nhan: 'Tội danh khác', kieu: 'chu', cot: 'crimeOther' },
    { key: 'noiXayRa', nhan: 'Nơi xảy ra', kieu: 'chu', cot: 'place' },
    { key: 'canBoNhap', nhan: 'Cán bộ nhập', kieu: 'chu', cot: 'entryOfficerName' },
    { key: 'loaiHoSo', nhan: 'Loại hồ sơ', kieu: 'chon', cot: 'caseType', giaTriHopLe: Object.values(WardCaseType) },
    { key: 'phanCong', nhan: 'Phân công', kieu: 'chon', cot: 'kind', giaTriHopLe: Object.values(WardAssignmentKind) },
    { key: 'ngayTrinh', nhan: 'Ngày trình', kieu: 'ngay', cot: 'submittedAt' },
    { key: 'hanBaoKetQua', nhan: 'Hạn báo kết quả', kieu: 'ngay', cot: 'resultDueOn' },
  ],
};
