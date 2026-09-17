import type { KhaiThucThe } from '../sinh/sinh-tim-kiem';
import { KHAI_TIM_KIEM_ANH_XA_DIA_CHI } from './anh-xa-dia-chi.khai';
import { KHAI_TIM_KIEM_DANH_MUC } from './danh-muc.khai';
import { KHAI_TIM_KIEM_DOI_TUONG } from './doi-tuong.khai';
import { KHAI_TIM_KIEM_DON_THU } from './don-thu.khai';
import { KHAI_TIM_KIEM_HUONG_DAN } from './huong-dan.khai';
import { KHAI_TIM_KIEM_KIEN_NGHI } from './kien-nghi.khai';
import { KHAI_TIM_KIEM_LUAT_SU } from './luat-su.khai';
import { KHAI_TIM_KIEM_NGUOI_DUNG } from './nguoi-dung.khai';
import { KHAI_TIM_KIEM_NHAT_KY } from './nhat-ky.khai';
import { KHAI_TIM_KIEM_TAI_LIEU } from './tai-lieu.khai';
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
  KHAI_TIM_KIEM_DOI_TUONG,
  KHAI_TIM_KIEM_LUAT_SU,
  KHAI_TIM_KIEM_NGUOI_DUNG,
  KHAI_TIM_KIEM_DANH_MUC,
  KHAI_TIM_KIEM_TAI_LIEU,
  KHAI_TIM_KIEM_ANH_XA_DIA_CHI,
  KHAI_TIM_KIEM_NHAT_KY,
  KHAI_TIM_KIEM_HUONG_DAN,
  KHAI_TIM_KIEM_KIEN_NGHI,
];
