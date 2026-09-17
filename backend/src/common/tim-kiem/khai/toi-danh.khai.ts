import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';

/**
 * Khai bảng `crimes` (Tội danh BLHS, 316 điều) — CHƯA có màn danh sách riêng. Có mặt để sinh cột bóng
 * `name_bd`: đích của thẻ "Tội danh chính" ở Vụ án (`crimeChinh`). Đo prod 17/09/2026 trên vụ án
 * REGULAR gắn tổ phường: tội danh chính có ở 344/368 hồ sơ, ô chữ `crime` chỉ 36/368 — lọc tội danh
 * mà chỉ nhìn ô chữ thì bỏ sót chín phần mười.
 */
export const KHAI_TIM_KIEM_TOI_DANH: KhaiThucThe = {
  thucThe: 'toi-danh',
  bang: 'crimes',
  model: 'Crime',
  truong: [
    { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'code' },
    { key: 'ten', nhan: 'Tên tội danh', kieu: 'chu', cot: 'name' },
  ],
};
