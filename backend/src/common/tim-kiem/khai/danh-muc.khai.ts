import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Danh mục (`DirectoriesPage.tsx`) — bảng `directories` (15.913 dòng
 * prod 15/09/2026). Thứ tự = thứ tự cột: Mã, Tên danh mục, Mô tả, Thứ tự, Trạng thái.
 *
 * Mã danh mục ("VA", "T01") dùng `ma-thuong`: so đúng mã không phân biệt hoa thường. Cột "Cha" chỉ
 * hiện khi lọc theo cha và `parentId` không có quan hệ Prisma — lọc cha vẫn qua ô chọn cha sẵn có.
 */
export const KHAI_TIM_KIEM_DANH_MUC: KhaiThucThe = {
  thucThe: 'danh-muc',
  bang: 'directories',
  model: 'Directory',
  truong: [
    { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'code' },
    { key: 'ten', nhan: 'Tên danh mục', kieu: 'chu', cot: 'name' },
    { key: 'moTa', nhan: 'Mô tả', kieu: 'chu', cot: 'description' },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'isActive',
      giaTriCot: { active: true, inactive: false },
    },
  ],
};
