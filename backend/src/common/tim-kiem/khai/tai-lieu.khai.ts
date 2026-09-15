import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Tài liệu (`DocumentsPage.tsx`) — bảng `documents`. Thứ tự = thứ tự
 * cột: Tài liệu (tiêu đề / tên tệp gốc / mô tả), Loại, Vụ án, Vụ việc, Người upload, Ngày upload.
 *
 * Loại tài liệu là danh mục ĐỘNG (Directory DOCUMENT_TYPE) nên không khai danh sách giá trị cứng ở
 * đây — máy chủ so đúng mã. Vụ án / Vụ việc lọc theo TÊN đang hiện trên cột (`name_bd` của đích).
 */
export const KHAI_TIM_KIEM_TAI_LIEU: KhaiThucThe = {
  thucThe: 'tai-lieu',
  bang: 'documents',
  model: 'Document',
  truong: [
    { key: 'tieuDe', nhan: 'Tiêu đề', kieu: 'chu', cot: 'title' },
    { key: 'tenTep', nhan: 'Tên tệp', kieu: 'chu', cot: 'originalName' },
    { key: 'moTa', nhan: 'Mô tả', kieu: 'chu', cot: 'description' },
    { key: 'loai', nhan: 'Loại', kieu: 'chon', cot: 'documentType' },
    {
      key: 'vuAn',
      nhan: 'Vụ án',
      kieu: 'quan-he',
      quanHe: 'case',
      modelDich: 'Case',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    {
      key: 'vuViec',
      nhan: 'Vụ việc',
      kieu: 'quan-he',
      quanHe: 'incident',
      modelDich: 'Incident',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    {
      key: 'nguoiTaiLen',
      nhan: 'Người upload',
      kieu: 'nguoi',
      quanHe: 'uploadedBy',
    },
    { key: 'ngayTaiLen', nhan: 'Ngày upload', kieu: 'ngay', cot: 'createdAt' },
  ],
};
