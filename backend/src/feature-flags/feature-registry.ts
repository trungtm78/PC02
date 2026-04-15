/**
 * Central feature registry — imports every module's feature.manifest.ts
 * and exposes the full list.
 *
 * When you add a new module: create `<module>/feature.manifest.ts`,
 * export the manifest, then append one import + one entry below.
 * The test `feature-registry.spec.ts` enforces (a) uniqueness of keys,
 * (b) that every manifest in the filesystem is wired up here.
 */

import type { FeatureManifest } from './feature-manifest';

import { AUTH_MANIFEST } from '../auth/feature.manifest';
import { AUDIT_MANIFEST } from '../audit/feature.manifest';
import { ADMIN_MANIFEST } from '../admin/feature.manifest';
import { DIRECTORY_MANIFEST } from '../directory/feature.manifest';
import { CASES_MANIFEST } from '../cases/feature.manifest';
import { SUBJECTS_MANIFEST } from '../subjects/feature.manifest';
import { LAWYERS_MANIFEST } from '../lawyers/feature.manifest';
import { PETITIONS_MANIFEST } from '../petitions/feature.manifest';
import { INCIDENTS_MANIFEST } from '../incidents/feature.manifest';
import { DOCUMENTS_MANIFEST } from '../documents/feature.manifest';
import { DASHBOARD_MANIFEST } from '../dashboard/feature.manifest';
import { CALENDAR_MANIFEST } from '../calendar/feature.manifest';
import { REPORTS_MANIFEST } from '../reports/feature.manifest';
import { PROPOSALS_MANIFEST } from '../proposals/feature.manifest';
import { GUIDANCE_MANIFEST } from '../guidance/feature.manifest';
import { EXCHANGES_MANIFEST } from '../exchanges/feature.manifest';
import { DELEGATIONS_MANIFEST } from '../delegations/feature.manifest';
import { CONCLUSIONS_MANIFEST } from '../conclusions/feature.manifest';
import { NOTIFICATIONS_MANIFEST } from '../notifications/feature.manifest';
import { INVESTIGATION_SUPPLEMENTS_MANIFEST } from '../investigation-supplements/feature.manifest';
import { MASTER_CLASS_MANIFEST } from '../master-class/feature.manifest';
import { TEAMS_MANIFEST } from '../teams/feature.manifest';
import { SETTINGS_MANIFEST } from '../settings/feature.manifest';
import { WORKFLOW_MANIFEST } from '../workflow/feature.manifest';
import { CLASSIFICATION_MANIFEST } from '../classification/feature.manifest';
import { FEATURE_FLAGS_MANIFEST } from './feature.manifest';

export const FEATURE_REGISTRY: readonly FeatureManifest[] = [
  AUTH_MANIFEST,
  AUDIT_MANIFEST,
  ADMIN_MANIFEST,
  DIRECTORY_MANIFEST,
  CASES_MANIFEST,
  SUBJECTS_MANIFEST,
  LAWYERS_MANIFEST,
  PETITIONS_MANIFEST,
  INCIDENTS_MANIFEST,
  DOCUMENTS_MANIFEST,
  DASHBOARD_MANIFEST,
  CALENDAR_MANIFEST,
  REPORTS_MANIFEST,
  PROPOSALS_MANIFEST,
  GUIDANCE_MANIFEST,
  EXCHANGES_MANIFEST,
  DELEGATIONS_MANIFEST,
  CONCLUSIONS_MANIFEST,
  NOTIFICATIONS_MANIFEST,
  INVESTIGATION_SUPPLEMENTS_MANIFEST,
  MASTER_CLASS_MANIFEST,
  TEAMS_MANIFEST,
  SETTINGS_MANIFEST,
  WORKFLOW_MANIFEST,
  CLASSIFICATION_MANIFEST,
  FEATURE_FLAGS_MANIFEST,
] as const;

export function getManifest(key: string): FeatureManifest | undefined {
  return FEATURE_REGISTRY.find((m) => m.key === key);
}

export function getManifestsByDomain(domain: string): FeatureManifest[] {
  return FEATURE_REGISTRY.filter((m) => m.domain === domain);
}
