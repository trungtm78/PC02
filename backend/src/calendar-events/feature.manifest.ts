import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CALENDAR_EVENTS_V2_MANIFEST: FeatureManifest = {
  key: 'calendar_events_v2',
  label: 'Sự kiện lịch v2',
  description: '3-tier scope (SYSTEM/TEAM/PERSONAL) + RRULE recurrence — thay thế Holiday model dần',
  domain: 'reporting-domain',
  /// Controller đã mang @FeatureFlag từ trước nhưng manifest không khai —
  /// `feature-gating.spec.ts` bắt được khi kiểm chiều ngược. Không khai thì
  /// người rà module không biết một cái cờ có thể lấy mất API của nó, và sự cố
  /// trông như lỗi.
  gating: 'api',
};
