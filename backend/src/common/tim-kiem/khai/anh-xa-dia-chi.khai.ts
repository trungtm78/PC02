import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai trường tìm được của mô-đun Ánh xạ địa chỉ trong Cài đặt (`AddressMappingModule.tsx`) — bảng
 * `address_mappings` (1.086 dòng prod 15/09/2026). Thứ tự = thứ tự cột: Phường/Xã cũ, Quận/Huyện cũ,
 * Phường/Xã mới, Tỉnh, Ghi chú, Trạng thái (cần xem lại).
 *
 * Giá trị lưu chữ thường có dấu ("phường 14", "quận phú nhuận") — cột bóng bỏ dấu cho gõ "phu nhuan".
 */
export const KHAI_TIM_KIEM_ANH_XA_DIA_CHI: KhaiThucThe = {
  thucThe: 'anh-xa-dia-chi',
  bang: 'address_mappings',
  model: 'AddressMapping',
  truong: [
    { key: 'phuongCu', nhan: 'Phường/Xã cũ', kieu: 'chu', cot: 'oldWard' },
    { key: 'quanCu', nhan: 'Quận/Huyện cũ', kieu: 'chu', cot: 'oldDistrict' },
    { key: 'phuongMoi', nhan: 'Phường/Xã mới', kieu: 'chu', cot: 'newWard' },
    { key: 'tinh', nhan: 'Tỉnh', kieu: 'ma-thuong', cot: 'province' },
    { key: 'ghiChu', nhan: 'Ghi chú', kieu: 'chu', cot: 'note' },
    {
      key: 'canXemLai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'needsReview',
      giaTriCot: { review: true, ok: false },
    },
  ],
};
