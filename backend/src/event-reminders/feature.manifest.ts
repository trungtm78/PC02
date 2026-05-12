import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const EVENT_REMINDERS_MANIFEST: FeatureManifest = {
  key: 'event_reminders_v2',
  label: 'Nhắc nhở sự kiện',
  description: 'FCM + email reminder cho calendar events, cron dispatcher mỗi 5 phút',
  domain: 'reporting-domain',
};
