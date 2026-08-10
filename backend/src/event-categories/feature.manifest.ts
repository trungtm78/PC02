import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const EVENT_CATEGORIES_MANIFEST: FeatureManifest = {
  key: 'event_categories_v2',
  label: 'Danh mục sự kiện (v2)',
  description: 'Quản lý danh mục sự kiện calendar — admin tự tạo categories với màu',
  domain: 'reporting-domain',
  /// Controller đã mang @FeatureFlag từ trước nhưng manifest không khai —
  /// `feature-gating.spec.ts` bắt được khi kiểm chiều ngược. Không khai thì
  /// người rà module không biết một cái cờ có thể lấy mất API của nó, và sự cố
  /// trông như lỗi.
  gating: 'api',
};
