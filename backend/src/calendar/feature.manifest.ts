import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CALENDAR_MANIFEST: FeatureManifest = {
  key: 'calendar',
  label: 'Lịch công tác',
  description: 'Deadline vụ án + sự kiện lịch làm việc',
  domain: 'reporting-domain',
  /// E6 — đợt rủi ro CAO. Chỉ MERGE sau khi PR-M1-mobile đã lên production và tỷ lệ APK cũ đủ thấp (ngưỡng chưa ấn định — xem PROGRESS.md). Controller mang @FeatureFlag cùng key — `feature-gating.spec.ts`
  /// kiểm hai bên khớp nhau theo cả hai chiều.
  gating: 'api',
};
