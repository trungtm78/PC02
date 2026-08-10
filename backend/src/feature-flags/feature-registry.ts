/**
 * Central feature registry.
 *
 * When you add a new module: create `<module>/feature.manifest.ts` and run
 * `npm run gen:feature-registry`. Nothing else. The list below is generated,
 * and CI fails if the committed generated file is stale.
 */

import type { FeatureManifest } from './feature-manifest';

import { GENERATED_FEATURE_REGISTRY } from './feature-registry.generated';

/**
 * The registry, generated from every `src/**\/feature.manifest.ts`.
 *
 * This used to be a hand-written import list. Three modules shipped without
 * being added to it — `comprehensive`, `document-templates`, and
 * `edit-window-requests` — and each time the symptom was a menu entry that
 * silently disappeared, because `listAll()` builds its answer from here and a
 * key that is not here does not exist as far as the frontend is concerned.
 *
 * Run `npm run gen:feature-registry` after adding a manifest; CI fails if the
 * committed file is stale.
 */
export const FEATURE_REGISTRY: readonly FeatureManifest[] =
  GENERATED_FEATURE_REGISTRY;

export function getManifest(key: string): FeatureManifest | undefined {
  return FEATURE_REGISTRY.find((m) => m.key === key);
}

export function getManifestsByDomain(domain: string): FeatureManifest[] {
  return FEATURE_REGISTRY.filter((m) => m.domain === domain);
}
