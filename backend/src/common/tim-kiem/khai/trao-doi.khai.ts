import { ExchangeStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Trao đổi chuyên án (`CaseExchangePage.tsx`) — bảng `exchanges`. Thứ tự =
 * thứ tự cột: Mã hồ sơ (+ loại), Đơn vị gửi, Đơn vị nhận, Thời gian khởi tạo, Trạng thái.
 *
 * - "Loại hồ sơ" là chữ tự do trong dữ liệu thật (đo prod 17/09/2026: "Tố giác", "Trao đổi chuyển án"…,
 *   73/76 rỗng) — tìm như chữ, không phải danh sách chọn.
 * - "Tin nhắn cuối" KHÔNG tìm được: là tin mới nhất qua quan hệ, không phải cột (prod có 0 tin nhắn).
 * - `subject` không có cột trên bảng nhưng giữ thông tin thật của hồ sơ di trú — thẻ `*` tìm được.
 */
export const KHAI_TIM_KIEM_TRAO_DOI: KhaiThucThe = {
  thucThe: 'trao-doi',
  bang: 'exchanges',
  model: 'Exchange',
  truong: [
    { key: 'maHoSo', nhan: 'Mã hồ sơ', kieu: 'ma-thuong', cot: 'recordCode' },
    { key: 'loaiHoSo', nhan: 'Loại hồ sơ', kieu: 'chu', cot: 'recordType' },
    { key: 'donViGui', nhan: 'Đơn vị gửi', kieu: 'chu', cot: 'senderUnit' },
    { key: 'donViNhan', nhan: 'Đơn vị nhận', kieu: 'chu', cot: 'receiverUnit' },
    {
      key: 'thoiGianKhoiTao',
      nhan: 'Thời gian khởi tạo',
      kieu: 'ngay',
      cot: 'createdAt',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(ExchangeStatus),
    },
  ],
  cotThemVaoTatCa: ['subject'],
};
