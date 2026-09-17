import { ProposalStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Kiến nghị VKS (`ProsecutorProposalPage.tsx`) — bảng `proposals`. Thứ tự =
 * thứ tự cột: Mã kiến nghị, Mã hồ sơ liên quan (tên vụ án), Nội dung, Ngày tạo, Đơn vị VKS, Trạng thái.
 *
 * "Hồ sơ liên quan" lọc theo TÊN vụ án đang hiện trên cột (`cases.name_bd`), như cột Vụ án ở Tài liệu.
 */
export const KHAI_TIM_KIEM_KIEN_NGHI: KhaiThucThe = {
  thucThe: 'kien-nghi',
  bang: 'proposals',
  model: 'Proposal',
  truong: [
    {
      key: 'maKienNghi',
      nhan: 'Mã kiến nghị',
      kieu: 'ma-thuong',
      cot: 'proposalNumber',
    },
    {
      key: 'hoSoLienQuan',
      nhan: 'Mã hồ sơ liên quan',
      kieu: 'quan-he',
      quanHe: 'relatedCase',
      modelDich: 'Case',
      cotDich: 'nameBd',
      cotNguonDich: ['name'],
    },
    { key: 'noiDung', nhan: 'Nội dung kiến nghị', kieu: 'chu', cot: 'content' },
    { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay', cot: 'createdAt' },
    { key: 'donViVks', nhan: 'Đơn vị VKS', kieu: 'chu', cot: 'unit' },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(ProposalStatus),
    },
  ],
};
