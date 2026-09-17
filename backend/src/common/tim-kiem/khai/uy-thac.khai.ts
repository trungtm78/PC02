import { DelegationStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Ủy thác điều tra (`InvestigationDelegationPage.tsx`) — bảng `delegations`.
 * Thứ tự = thứ tự cột: Số ủy thác (kèm dòng "Liên quan: <tên vụ án>"), Nội dung, Ngày ủy thác, Đơn vị nhận,
 * Người tạo, Trạng thái.
 */
export const KHAI_TIM_KIEM_UY_THAC: KhaiThucThe = {
  thucThe: 'uy-thac',
  bang: 'delegations',
  model: 'Delegation',
  truong: [
    {
      key: 'soUyThac',
      nhan: 'Số ủy thác',
      kieu: 'ma-thuong',
      cot: 'delegationNumber',
    },
    {
      key: 'hoSoLienQuan',
      nhan: 'Hồ sơ liên quan',
      kieu: 'quan-he',
      quanHe: 'relatedCase',
      modelDich: 'Case',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    { key: 'noiDung', nhan: 'Nội dung', kieu: 'chu', cot: 'content' },
    {
      key: 'ngayUyThac',
      nhan: 'Ngày ủy thác',
      kieu: 'ngay',
      cot: 'delegationDate',
    },
    {
      key: 'donViNhan',
      nhan: 'Đơn vị nhận',
      kieu: 'chu',
      cot: 'receivingUnit',
    },
    { key: 'nguoiTao', nhan: 'Người tạo', kieu: 'nguoi', quanHe: 'createdBy' },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(DelegationStatus),
    },
  ],
};
