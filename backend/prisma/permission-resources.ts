/**
 * The catalogue of screens and functions a team can be given, for "permissions by team".
 *
 * `seed-permissions.ts` lists the raw `action:subject` pairs the route guards check. That list says nothing a person
 * setting permissions can use: which pairs make up "Đơn thư", which of them is "Thêm", whether "Xem" can be limited
 * to one's own records. This file says it, once: every seeded pair belongs to exactly one resource here (gate:
 * `src/authz/permission-resources.gate.spec.ts`), so nothing can be granted that the screen cannot show, and nothing
 * the guards check is missing from the screen.
 *
 * No display text lives here: the screen names a resource and a capability by their keys
 * (`frontend/src/locales/permissions.vi.ts`).
 *
 * Located in `prisma/` for the same reason as `seed-permissions.ts`: the deploy bundle runs seeds from this folder.
 */

/** A permission as the guards and `/auth/me` write it. */
export type PermissionKey = `${string}:${string}`;

/**
 * How far a grant reaches over records.
 *   NONE       not granted
 *   OWN        records the person owns (see `RecordScope.ownerField`); never unassigned records
 *   TEAM       records assigned to the very team that gives the grant; never unassigned records
 *   TEAM_TREE  that team, the teams under it, its members' records and unassigned records: what a member sees today
 *   ALL        every record
 */
export const PERMISSION_DEPTHS = ['NONE', 'OWN', 'TEAM', 'TEAM_TREE', 'ALL'] as const;
export type PermissionDepth = (typeof PERMISSION_DEPTHS)[number];

/** Narrowest to widest: a wider depth includes every narrower one. */
export const depthRank = (depth: PermissionDepth): number => PERMISSION_DEPTHS.indexOf(depth);

export const RESOURCE_GROUPS = ['business', 'reports', 'catalogue', 'admin'] as const;
export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

/** The four things every screen of a resource can be allowed or not. A resource may lack some. */
export const BASIC_CAPABILITIES = ['view', 'create', 'edit', 'delete'] as const;
export type BasicCapability = (typeof BASIC_CAPABILITIES)[number];

export type RecordScope =
  /** Records of this resource carry their own team and owner. */
  | { kind: 'own'; subject: string; ownerField: 'investigatorId' | 'enteredById' }
  /** A child of another resource's record: it is reached as far as its parent is. */
  | { kind: 'parent'; resource: string };

export interface PermissionResource {
  /** Stable key: stored in templates' history and used by the screen for the label. Never rename. */
  key: string;
  group: ResourceGroup;
  /** "Xem", "Thêm", "Sửa", "Xoá". Two capabilities may share one pair (a subject with a single `write`). */
  basic: Partial<Record<BasicCapability, PermissionKey>>;
  /** Anything else the resource can be allowed, by a stable key of its own. */
  extras?: Readonly<Record<string, PermissionKey>>;
  /** Present when the grant can be limited to OWN / TEAM / TEAM_TREE; absent = the grant is all or nothing. */
  recordScope?: RecordScope;
  /** Pairs whose grant needs a reason (they reach personal data in bulk, or the permission system itself). */
  sensitive?: readonly PermissionKey[];
}

export const PERMISSION_RESOURCES: readonly PermissionResource[] = [
  // ── Business ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    key: 'petitions',
    group: 'business',
    basic: { view: 'read:Petition', create: 'write:Petition', edit: 'edit:Petition', delete: 'delete:Petition' },
    extras: { restore: 'restore:Petition', exportFull: 'export_full:Petition' },
    recordScope: { kind: 'own', subject: 'Petition', ownerField: 'enteredById' },
    sensitive: ['export_full:Petition'],
  },
  {
    key: 'incidents',
    group: 'business',
    basic: { view: 'read:Incident', create: 'write:Incident', edit: 'edit:Incident', delete: 'delete:Incident' },
    extras: { restore: 'restore:Incident' },
    recordScope: { kind: 'own', subject: 'Incident', ownerField: 'investigatorId' },
  },
  {
    key: 'cases',
    group: 'business',
    basic: { view: 'read:Case', create: 'write:Case', edit: 'edit:Case', delete: 'delete:Case' },
    extras: { restore: 'restore:Case' },
    recordScope: { kind: 'own', subject: 'Case', ownerField: 'investigatorId' },
  },
  {
    key: 'subjects',
    group: 'business',
    basic: { view: 'read:Subject', create: 'write:Subject', edit: 'edit:Subject', delete: 'delete:Subject' },
    recordScope: { kind: 'parent', resource: 'cases' },
  },
  {
    key: 'lawyers',
    group: 'business',
    basic: { view: 'read:Lawyer', create: 'write:Lawyer', edit: 'edit:Lawyer', delete: 'delete:Lawyer' },
    recordScope: { kind: 'parent', resource: 'cases' },
  },
  {
    key: 'documents',
    group: 'business',
    basic: { view: 'read:Document', create: 'write:Document', edit: 'edit:Document', delete: 'delete:Document' },
    recordScope: { kind: 'parent', resource: 'cases' },
  },
  {
    key: 'calendar',
    group: 'business',
    basic: { view: 'read:Calendar', create: 'write:Calendar', edit: 'edit:Calendar', delete: 'delete:Calendar' },
  },
  {
    key: 'caseGovernance',
    group: 'business',
    basic: { view: 'read:CaseGovernance' },
    extras: {
      readSensitive: 'read_sensitive:CaseGovernance',
      operate: 'operate:CaseGovernance',
      review: 'review:CaseGovernance',
      publish: 'publish:CaseGovernance',
      share: 'share:CaseGovernance',
      download: 'download:CaseGovernance',
      manageAccess: 'manage_access:CaseGovernance',
      custody: 'custody:CaseGovernance',
      dispose: 'dispose:CaseGovernance',
    },
    sensitive: ['read_sensitive:CaseGovernance', 'manage_access:CaseGovernance', 'dispose:CaseGovernance'],
  },

  // ── Reports ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    key: 'statutoryReports',
    group: 'reports',
    basic: { view: 'read:Report', create: 'write:Report', edit: 'write:Report' },
    extras: { approve: 'approve:Report' },
  },
  {
    key: 'dynamicReports',
    group: 'reports',
    basic: { view: 'read:DynamicReport' },
    extras: { manage: 'manage:DynamicReport', admin: 'admin:DynamicReport' },
  },
  {
    key: 'auditLog',
    group: 'reports',
    basic: { view: 'read:AuditLog' },
    sensitive: ['read:AuditLog'],
  },

  // ── Catalogues and rules ──────────────────────────────────────────────────────────────────────────────────────
  {
    key: 'directory',
    group: 'catalogue',
    basic: { view: 'read:Directory', create: 'write:Directory', edit: 'write:Directory', delete: 'delete:Directory' },
  },
  {
    key: 'deadlineRules',
    group: 'catalogue',
    basic: { view: 'read:DeadlineRuleVersion', create: 'write:DeadlineRuleVersion', edit: 'write:DeadlineRuleVersion' },
    extras: {
      approve: 'approve:DeadlineRuleVersion',
      withdrawOwn: 'withdraw_own:DeadlineRuleVersion',
      requestChanges: 'request_changes:DeadlineRuleVersion',
    },
  },

  // ── Administration ────────────────────────────────────────────────────────────────────────────────────────────
  {
    key: 'users',
    group: 'admin',
    basic: { view: 'read:User', create: 'write:User', edit: 'write:User', delete: 'delete:User' },
    sensitive: ['write:User', 'delete:User'],
  },
  {
    key: 'roles',
    group: 'admin',
    basic: { view: 'read:Role', create: 'write:Role', edit: 'write:Role', delete: 'delete:Role' },
    sensitive: ['write:Role', 'delete:Role'],
  },
  {
    key: 'teams',
    group: 'admin',
    basic: { view: 'read:Team', create: 'write:Team', edit: 'edit:Team', delete: 'delete:Team' },
  },
  {
    key: 'settings',
    group: 'admin',
    basic: { view: 'read:Setting', edit: 'write:Setting' },
  },
  {
    key: 'llmConfig',
    group: 'admin',
    basic: { view: 'read:LlmConfig', edit: 'write:LlmConfig' },
    sensitive: ['write:LlmConfig'],
  },
  {
    key: 'ocrImport',
    group: 'admin',
    basic: {},
    extras: { use: 'use:OcrImport', sendInternal: 'sendInternal:OcrImport', sendCloud: 'sendCloud:OcrImport' },
    sensitive: ['sendCloud:OcrImport'],
  },
  {
    key: 'ocrQuality',
    group: 'admin',
    basic: { view: 'read:OcrQuality' },
  },
  {
    key: 'editWindow',
    group: 'admin',
    basic: {},
    extras: { reviewResetRequest: 'review_reset_request:EditWindowResetRequest' },
  },
];

/** Every pair of a resource, each once. */
export function pairsOf(resource: PermissionResource): PermissionKey[] {
  return [...new Set([...Object.values(resource.basic), ...Object.values(resource.extras ?? {})])];
}

const byKey = new Map(PERMISSION_RESOURCES.map((r) => [r.key, r]));
const byPair = new Map(PERMISSION_RESOURCES.flatMap((r) => pairsOf(r).map((p) => [p, r] as const)));

export const resourceByKey = (key: string): PermissionResource | undefined => byKey.get(key);
export const resourceOfPermission = (pair: string): PermissionResource | undefined => byPair.get(pair as PermissionKey);

/**
 * The record subject a resource's reach is measured on: its own, or its parent's (a document is reached as far as
 * its case). Undefined = the resource has no per-record reach (its grants are all or nothing).
 */
export function scopeSubjectOf(resource: PermissionResource): string | undefined {
  const seen = new Set<string>();
  for (let r: PermissionResource | undefined = resource; r?.recordScope && !seen.has(r.key); ) {
    if (r.recordScope.kind === 'own') return r.recordScope.subject;
    seen.add(r.key);
    r = byKey.get(r.recordScope.resource);
  }
  return undefined;
}

/** The depths a pair may be granted at: every depth for a record-scoped resource, else only NONE or ALL. */
export function allowedDepths(pair: string): readonly PermissionDepth[] {
  const resource = resourceOfPermission(pair);
  return resource && scopeSubjectOf(resource) ? PERMISSION_DEPTHS : ['NONE', 'ALL'];
}

export const isSensitivePermission = (pair: string): boolean =>
  resourceOfPermission(pair)?.sensitive?.includes(pair as PermissionKey) ?? false;
