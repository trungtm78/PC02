import type { FeatureManifest } from '../../feature-flags/feature-manifest';

/**
 * Công tắc khẩn của ô tìm kiếm dạng thẻ trên các màn danh sách.
 *
 * Giao diện đọc cờ này kiểu BẬT MẶC ĐỊNH (`useFeatureBatMacDinh`): chỉ khi quản trị tắt thì màn
 * danh sách trở lại ô chữ `q` → `search`. Máy chủ luôn nhận cả `search` lẫn `tk`, nên tắt/bật
 * không cần deploy.
 */
export const TIM_KIEM_THE_MANIFEST: FeatureManifest = {
  key: 'TIM_KIEM_THE',
  label: 'Tìm kiếm dạng thẻ',
  description: 'Ô tìm kiếm danh sách chọn được cột, gõ không dấu (tắt → trở lại ô chữ cũ)',
  domain: 'core',
};
