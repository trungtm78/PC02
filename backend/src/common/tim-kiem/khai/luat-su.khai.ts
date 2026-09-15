import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của bảng `lawyers` — màn Luật sư (`LawyerListPageShell`). Theo ĐÚNG cột màn
 * hình: Họ tên, Số thẻ, Văn phòng, Vụ án, Bị can / Thân chủ, SĐT, Ngày tạo.
 *
 * Vụ án và Thân chủ là quan hệ MỘT-MỘT (`Lawyer.case`, `Lawyer.subject`) — kiểu `quan-he` lọc bằng
 * `is` trên cột bóng có sẵn của đích (`cases.tim_kiem_bd` do khai Vụ án sinh, `subjects.full_name_bd`).
 */
export const KHAI_TIM_KIEM_LUAT_SU: KhaiThucThe = {
  thucThe: 'luat-su',
  bang: 'lawyers',
  model: 'Lawyer',
  truong: [
    { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu', cot: 'fullName' },
    { key: 'soThe', nhan: 'Số thẻ', kieu: 'chu', cot: 'barNumber' },
    { key: 'vanPhong', nhan: 'Văn phòng', kieu: 'chu', cot: 'lawFirm' },
    {
      key: 'vuAn',
      nhan: 'Vụ án',
      kieu: 'quan-he',
      quanHe: 'case',
      modelDich: 'Case',
      cotDich: 'timKiemBd',
      cotNguonDich: ['caseCode', 'name'],
    },
    {
      key: 'thanChu',
      nhan: 'Bị can / Thân chủ',
      kieu: 'quan-he',
      quanHe: 'subject',
      modelDich: 'Subject',
      cotDich: 'fullNameBd',
      cotNguonDich: ['fullName'],
    },
    { key: 'sdt', nhan: 'SĐT', kieu: 'chu', cot: 'phone' },
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt' },
  ],
};
