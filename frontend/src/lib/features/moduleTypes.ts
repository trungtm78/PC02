import type { ReactElement } from 'react';

/**
 * Feature module manifest — each `features/<name>/feature.manifest.ts`
 * exports one of these. Metadata only; behavior comes from `routes.tsx`
 * and `menu.ts` which live alongside the manifest.
 */
export interface FeatureModuleManifest {
  /** Must match the key used in the backend feature_flags table. */
  key: string;
  label: string;
  description?: string;
  domain:
    | 'core'
    | 'org-domain'
    | 'case-domain'
    | 'petition-domain'
    | 'workflow-domain'
    | 'reporting-domain';
  /** Lucide icon name. Resolved lazily by consumers. */
  icon?: string;
}

/**
 * A feature module = manifest + routes + menu entries. Each feature folder
 * exposes this object as its default export (or via a named `feature` export).
 * The registry builds a map of modules keyed by `manifest.key`.
 */
export interface FeatureModule {
  manifest: FeatureModuleManifest;
  /** Returns an array of <Route> elements. Called once at mount. */
  renderRoutes: () => ReactElement[];
  /** Menu entries to merge into the sidebar. */
  menu?: FeatureMenuEntry[];
}

export interface FeatureMenuEntry {
  /** Which top-level sidebar section this entry belongs to. */
  section:
    | 'main'
    | 'business'
    | 'workflow'
    | 'reports'
    | 'system'
    | 'admin';
  /** Stable id — used for active-path detection and favorites. */
  id: string;
  label: string;
  path?: string;
  icon?: string;
  badge?: string;
  children?: FeatureMenuEntry[];
}
