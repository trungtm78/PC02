import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import { KHAI_TIM_KIEM_DON_THU } from './don-thu.khai';
import { KHAI_TIM_KIEM_VU_AN } from './vu-an.khai';
import { KHAI_TIM_KIEM_VU_VIEC } from './vu-viec.khai';

/**
 * Mọi thực thể có ô tìm dạng thẻ phía máy chủ. Thứ tự cố định — bộ sinh xuất theo thứ tự này nên
 * đổi thứ tự là đổi tệp sinh ra.
 */
export const KHAI_TIM_KIEM: readonly KhaiThucThe[] = [
  KHAI_TIM_KIEM_DON_THU,
  KHAI_TIM_KIEM_VU_VIEC,
  KHAI_TIM_KIEM_VU_AN,
];
