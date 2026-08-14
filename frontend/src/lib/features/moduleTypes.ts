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
    | 'reporting-domain'
    | 'admin-domain';
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

/**
 * The permission a menu entry answers to.
 *
 * ND-22: the sidebar filtered on feature flags alone, so a module switched on
 * for the unit listed its screens for everybody — including users the backend
 * would answer 403. Two different questions were being asked with one answer:
 * "is this module part of this deployment" (the flag) and "may this user open
 * it" (the grant).
 *
 * Optional on purpose. An entry with no `requires` is governed by its flag
 * alone, which is right for modules the seed defines no subject for — gating
 * those would mean inventing a grant to check.
 */
export interface FeatureMenuPermission {
  /** Frontend resource key, e.g. `cases`. See `PERMISSION_RESOURCE`. */
  resource: string;
  /** Defaults to `view`. */
  action?: 'view' | 'create' | 'edit' | 'delete';
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
  /** Hide this entry unless the user holds this grant. See the type's note. */
  requires?: FeatureMenuPermission;
  /**
   * Sort order within the section (ascending). Lower = earlier.
   * Default 100. Use lower values (e.g. 10) to surface an item above
   * the alphabetical default. Ties preserve registration order.
   */
  order?: number;
}
