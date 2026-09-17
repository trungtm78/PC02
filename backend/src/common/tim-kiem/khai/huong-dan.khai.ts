import { GuidanceStatus } from '@prisma/client';
import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của màn Hướng dẫn đơn (`PetitionGuidancePage.tsx`) — bảng `guidance_records`.
 * Thứ tự = thứ tự cột: Ngày, Vấn đề, Đơn vị, Người nhập, Người được hướng dẫn (tên + SĐT), Trạng thái.
 *
 * Cột STT (`năm-stt` hệ cũ) chưa tìm được: bảng chưa có cột mã, mã đọc từ `legacyRaw` lúc trả danh
 * sách. Nội dung hướng dẫn không có cột trên bảng nhưng là chỗ chứa thông tin thật của hồ sơ di trú
 * (`tom_tat_noi_dung`) — thẻ "tất cả các cột" phải tìm được.
 */
export const KHAI_TIM_KIEM_HUONG_DAN: KhaiThucThe = {
  thucThe: 'huong-dan',
  bang: 'guidance_records',
  model: 'GuidanceRecord',
  truong: [
    { key: 'ngay', nhan: 'Ngày', kieu: 'ngay', cot: 'date' },
    { key: 'vanDe', nhan: 'Vấn đề', kieu: 'chu', cot: 'subject' },
    { key: 'donVi', nhan: 'Đơn vị', kieu: 'chu', cot: 'unit' },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'createdBy',
    },
    {
      key: 'nguoiDuocHuongDan',
      nhan: 'Người được hướng dẫn',
      kieu: 'chu',
      cot: 'nguoiDuocHuongDan',
      cotGhep: ['guidedPerson', 'guidedPersonPhone'],
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: Object.values(GuidanceStatus),
    },
  ],
  cotThemVaoTatCa: ['guidanceContent'],
};
