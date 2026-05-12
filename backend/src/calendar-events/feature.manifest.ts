import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const CALENDAR_EVENTS_V2_MANIFEST: FeatureManifest = {
  key: 'calendar_events_v2',
  label: 'Sự kiện lịch v2',
  description: '3-tier scope (SYSTEM/TEAM/PERSONAL) + RRULE recurrence — thay thế Holiday model dần',
  domain: 'reporting-domain',
};
