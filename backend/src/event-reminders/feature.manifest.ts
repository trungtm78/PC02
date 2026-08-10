import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const EVENT_REMINDERS_MANIFEST: FeatureManifest = {
  key: 'event_reminders_v2',
  label: 'Nhắc nhở sự kiện',
  description: 'FCM + email reminder cho calendar events, cron dispatcher mỗi 5 phút',
  domain: 'reporting-domain',
  /// Controller đã mang @FeatureFlag từ trước nhưng manifest không khai —
  /// `feature-gating.spec.ts` bắt được khi kiểm chiều ngược. Không khai thì
  /// người rà module không biết một cái cờ có thể lấy mất API của nó, và sự cố
  /// trông như lỗi.
  gating: 'api',
};
