import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

/** Same key as the backend switch (`backend/src/ward-assignments/feature.manifest.ts`): off → no menu, routes 404. */
export const wardAssignmentsManifest: FeatureModuleManifest = {
  key: 'ward-assignments',
  label: L.menu.group,
  description: L.subtitle,
  domain: 'case-domain',
  icon: 'ClipboardList',
};
