/**
 * Feature manifest — each module owns one of these.
 *
 * The manifest is the single source of truth for a module's feature
 * identity: its flag key, the human label, the bounded context it lives
 * in, and the permissions it declares. This metadata is imported by a
 * central registry so that (a) the seed script can keep feature_flags
 * in sync with code without hand-editing, and (b) downstream tools
 * (OpenAPI docs, permission audits) can introspect modules uniformly.
 *
 * Adding a new module = create `feature.manifest.ts` alongside the
 * module file and export a const. The registry file will import it.
 */

export interface PermissionDeclaration {
  action: string;
  subject: string;
}

export interface FeatureManifest {
  /** Unique key, used as feature flag key and frontend route prefix. */
  key: string;
  /** Vietnamese display name shown in sidebar / admin panel. */
  label: string;
  /** One-line description (optional). */
  description?: string;
  /** Bounded context: 'core' | 'org-domain' | 'case-domain' | 'petition-domain' | 'workflow-domain' | 'reporting-domain'. */
  domain: string;
  /** Permissions this module owns — used by seed script + admin UI. */
  permissions?: PermissionDeclaration[];
  /**
   * Whether the feature is ON when nothing has been decided about it yet. Default (omitted) is ON, as for every
   * feature so far. `false` = the seed creates its row disabled and a missing row reads as disabled, so a database
   * built without migrations (`prisma db push` + seed) does not expose a half-built feature.
   * An existing row always decides: the seed never changes `enabled`.
   */
  defaultEnabled?: boolean;
}
