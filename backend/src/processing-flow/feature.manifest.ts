import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * The configuration of processing flows and deadlines per information type: the settings screens and their routes
 * (flows, bindings, versions, steps, the working calendar).
 *
 * OFF until an administrator turns it on: its row is inserted disabled by the migration `proc_flow_config` (a flag
 * with no row would read as ON). Two sibling switches cover what later changes add on top of the configuration:
 * `records/feature.manifest.ts` and `reminders/feature.manifest.ts`.
 */
export const PROCESSING_FLOW_MANIFEST: FeatureManifest = {
  key: 'processing_flow',
  label: 'Quy trình & hạn xử lý',
  description: 'Thiết lập quy trình xử lý và thời hạn theo loại thông tin; lịch làm việc để tính hạn',
  domain: 'workflow-domain',
  permissions: [
    { action: 'read', subject: 'ProcessingFlow' },
    { action: 'create', subject: 'ProcessingFlow' },
    { action: 'edit', subject: 'ProcessingFlow' },
    { action: 'delete', subject: 'ProcessingFlow' },
    { action: 'publish', subject: 'ProcessingFlow' },
    { action: 'verify', subject: 'ProcessingFlow' },
    { action: 'read', subject: 'ProcessingCalendar' },
    { action: 'edit', subject: 'ProcessingCalendar' },
    { action: 'confirm', subject: 'ProcessingCalendar' },
  ],
};
