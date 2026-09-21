import { SubjectStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của bảng `subjects` — DÙNG CHUNG cho ba màn Đối tượng (bị can, bị hại, nhân
 * chứng — `ObjectListPageShell`, lọc `type` riêng ngoài thẻ). Theo ĐÚNG cột màn hình: Họ tên, CCCD,
 * Vụ án (quan hệ một-một tới `cases`), Trạng thái, Ngày tạo.
 *
 * Bảng `subjects` còn được thẻ "Đối tượng bị can" của Vụ án dùng (`full_name_bd`) — bộ sinh gộp hai
 * nguồn thành MỘT trigger. Thẻ "tất cả các cột" gồm địa chỉ và SĐT: ô tìm cũ tìm cả hai.
 */
export const KHAI_TIM_KIEM_DOI_TUONG: KhaiThucThe = {
  thucThe: 'doi-tuong',
  bang: 'subjects',
  model: 'Subject',
  truong: [
    { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu', cot: 'fullName' },
    { key: 'cccd', nhan: 'CCCD', kieu: 'chu', cot: 'idNumber' },
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
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(SubjectStatus),
    },
    /* Ngày nhập đối tượng là mốc nghiệp vụ dùng thật trên màn. */
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt', vaoTatCa: true },
  ],
  cotThemVaoTatCa: ['address', 'phone'],
};
