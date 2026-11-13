/** Shapes and constants of "permissions by team" (`/authz` on the server). Enum strings are declared once, here. */

export const REACH = { OWN: 'OWN', TEAM: 'TEAM', TEAM_TREE: 'TEAM_TREE', ALL: 'ALL' } as const;
export type Reach = (typeof REACH)[keyof typeof REACH];
/** Narrowest first. */
export const REACH_ORDER: readonly Reach[] = [REACH.OWN, REACH.TEAM, REACH.TEAM_TREE, REACH.ALL];
/** The three choices of the plain screen; "exactly this team" (TEAM) is an advanced one. */
export const PLAIN_REACHES: readonly Reach[] = [REACH.OWN, REACH.TEAM_TREE, REACH.ALL];

export const AUTHZ_MODE = { OFF: 'OFF', SHADOW: 'SHADOW', ENFORCE: 'ENFORCE' } as const;
export type AuthzMode = (typeof AUTHZ_MODE)[keyof typeof AUTHZ_MODE];
/** The modes one administrator may switch to at once. Enforcing is asked for and approved instead. */
export type SwitchableMode = typeof AUTHZ_MODE.OFF | typeof AUTHZ_MODE.SHADOW;

export const CAPABILITY = { VIEW: 'view', CREATE: 'create', EDIT: 'edit', DELETE: 'delete' } as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
export const CAPABILITIES: readonly Capability[] = [CAPABILITY.VIEW, CAPABILITY.CREATE, CAPABILITY.EDIT, CAPABILITY.DELETE];
/** The capabilities shown as tick columns (everything but "view", which has its own cell). */
export const ACTION_CAPABILITIES: readonly Capability[] = [CAPABILITY.CREATE, CAPABILITY.EDIT, CAPABILITY.DELETE];

export const RESOURCE_GROUP = { BUSINESS: 'business', REPORTS: 'reports', CATALOGUE: 'catalogue', ADMIN: 'admin' } as const;
export type ResourceGroup = (typeof RESOURCE_GROUP)[keyof typeof RESOURCE_GROUP];
export const RESOURCE_GROUPS: readonly ResourceGroup[] = [
  RESOURCE_GROUP.BUSINESS,
  RESOURCE_GROUP.REPORTS,
  RESOURCE_GROUP.CATALOGUE,
  RESOURCE_GROUP.ADMIN,
];

export const TEMPLATE_STATUS = { ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' } as const;
export type TemplateStatus = (typeof TEMPLATE_STATUS)[keyof typeof TEMPLATE_STATUS];
export const TEMPLATE_STATUSES: readonly TemplateStatus[] = [TEMPLATE_STATUS.ACTIVE, TEMPLATE_STATUS.ARCHIVED];

export const TEAM_MODE = { INHERIT: 'INHERIT', EXPLICIT: 'EXPLICIT' } as const;
export type TeamMode = (typeof TEAM_MODE)[keyof typeof TEAM_MODE];

export const EFFECT = { GRANT: 'GRANT', MUTE: 'MUTE' } as const;
export type Effect = (typeof EFFECT)[keyof typeof EFFECT];

export const AUDIENCE = { ALL: 'ALL', MEMBER: 'MEMBER', LEADER: 'LEADER' } as const;
export type Audience = (typeof AUDIENCE)[keyof typeof AUDIENCE];
export const AUDIENCES: readonly Audience[] = [AUDIENCE.ALL, AUDIENCE.MEMBER, AUDIENCE.LEADER];

export const GRANT_SOURCE = {
  ROLE: 'ROLE',
  TEMPLATE: 'TEMPLATE',
  TEAM_OVERRIDE: 'TEAM_OVERRIDE',
  USER_OVERRIDE: 'USER_OVERRIDE',
} as const;
export type GrantSource = (typeof GRANT_SOURCE)[keyof typeof GRANT_SOURCE];

export const CHANGE_TYPE = { TEMPLATE: 'template', TEAM: 'team', USER: 'user' } as const;
export type ChangeType = (typeof CHANGE_TYPE)[keyof typeof CHANGE_TYPE];

/** Server permissions that open this screen and allow changing things on it. */
export const SCREEN_PERMISSION = { READ: 'read:Role', WRITE: 'write:Role' } as const;

/** Error codes of the `/authz` routes. */
export const AUTHZ_ERROR = {
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  INVALID: 'AUTHZ_CHANGE_INVALID',
  TEMPLATE_IN_USE: 'TEMPLATE_IN_USE',
  TEMPLATE_CODE_TAKEN: 'TEMPLATE_CODE_TAKEN',
  CHANGED_SINCE: 'AUTHZ_CHANGED_SINCE',
  ALREADY_UNDONE: 'AUTHZ_ALREADY_UNDONE',
  USER_NOT_FOUND: 'AUTHZ_USER_NOT_FOUND',
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  EXPECTED_REVISION_REQUIRED: 'EXPECTED_REVISION_REQUIRED',
  STARTER_ROLE_NOT_FOUND: 'STARTER_ROLE_NOT_FOUND',
} as const;

/** Error codes of the `/authz/mode` routes (switching permissions by team on and off). */
export const AUTHZ_MODE_ERROR = {
  ADMIN_ONLY: 'AUTHZ_MODE_ADMIN_ONLY',
  REASON_REQUIRED: 'AUTHZ_MODE_REASON_REQUIRED',
  ENFORCE_NEEDS_REQUEST: 'AUTHZ_MODE_ENFORCE_NEEDS_REQUEST',
  ENFORCE_NOT_AVAILABLE: 'AUTHZ_MODE_ENFORCE_NOT_AVAILABLE',
  COMPARISON_CHANGED: 'AUTHZ_MODE_COMPARISON_CHANGED',
  ALREADY: 'AUTHZ_MODE_ALREADY',
  REQUEST_PENDING: 'AUTHZ_MODE_REQUEST_PENDING',
  REQUEST_NOT_FOUND: 'AUTHZ_MODE_REQUEST_NOT_FOUND',
  REQUEST_NOT_PENDING: 'AUTHZ_MODE_REQUEST_NOT_PENDING',
  REQUEST_EXPIRED: 'AUTHZ_MODE_REQUEST_EXPIRED',
  SECOND_ADMIN_REQUIRED: 'AUTHZ_MODE_SECOND_ADMIN_REQUIRED',
  WOULD_LOCK_OUT: 'AUTHZ_MODE_WOULD_LOCK_OUT',
  /** 503: the configuration cannot be read right now. */
  UNAVAILABLE: 'AUTHZ_UNAVAILABLE',
} as const;
/** Refusals that mean the screen shows something older than the server has: the way forward is to load again. */
export const AUTHZ_MODE_STALE_ERRORS: readonly string[] = [
  AUTHZ_MODE_ERROR.COMPARISON_CHANGED,
  AUTHZ_MODE_ERROR.ALREADY,
  AUTHZ_MODE_ERROR.REQUEST_PENDING,
  AUTHZ_MODE_ERROR.REQUEST_NOT_FOUND,
  AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING,
  AUTHZ_MODE_ERROR.REQUEST_EXPIRED,
];

export const MODE_CHANGE_STATUS = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  WITHDRAWN: 'WITHDRAWN',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type ModeChangeStatus = (typeof MODE_CHANGE_STATUS)[keyof typeof MODE_CHANGE_STATUS];

export const PAGE_TAB = { TEMPLATES: 'templates', TEAMS: 'teams', LOOKUP: 'lookup', HISTORY: 'history', APPLY: 'apply' } as const;
export type PageTab = (typeof PAGE_TAB)[keyof typeof PAGE_TAB];
export const PAGE_TABS: readonly PageTab[] = [PAGE_TAB.TEMPLATES, PAGE_TAB.TEAMS, PAGE_TAB.LOOKUP, PAGE_TAB.HISTORY, PAGE_TAB.APPLY];
export const PAGE_PATH = '/admin/phan-quyen';
/** Changes per page of the history. */
export const HISTORY_PAGE = 50;

/** `action:Subject` -> how far it reaches. A missing key = not granted. */
export type Entries = Readonly<Record<string, Reach>>;

export interface CatalogueResource {
  key: string;
  group: ResourceGroup;
  /** Two capabilities may share one permission key. */
  basic: Partial<Record<Capability, string>>;
  extras: Readonly<Record<string, string>>;
  /** False = the grant is all or nothing (only ALL). */
  recordScoped: boolean;
  /** Permission keys whose grant needs a reason. */
  sensitive: readonly string[];
}
export interface Catalogue {
  mode: AuthzMode;
  resources: CatalogueResource[];
}

export interface TemplateSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  revision: number;
  entries: Entries;
  usedByTeams: number;
}

export interface Override {
  permission: string;
  effect: Effect;
  reach: Reach | null;
  reason: string;
  /** ISO date-time, or null for no end. */
  expiresAt: string | null;
}
export interface TeamOverride extends Override {
  audience: Audience;
}

export interface TeamConfig {
  mode: TeamMode;
  memberTemplateId: string | null;
  /** Null = same as members. */
  leaderTemplateId: string | null;
  overrides: TeamOverride[];
}

export interface TeamRow {
  teamId: string;
  name: string;
  code: string;
  parentId: string | null;
  status: string;
  members: number;
  /** 0 = the team has no configuration of its own. */
  revision: number;
  config: TeamConfig | null;
  /** Null = nobody above has set anything: members keep what their role gives. */
  governedByTeamId: string | null;
  governedByTeamName: string | null;
}

export interface PermissionDelta {
  permission: string;
  before: Reach | null;
  after: Reach | null;
  /** Team ids newly reached / no longer reached (on `changed` when the reach word stays but the teams differ). */
  teamsGained?: string[];
  teamsLost?: string[];
  /**
   * On `changed` only: the permission is kept but reaches less somewhere / more somewhere. Both may be true at once,
   * and either may be true with no team gained or lost (the whole team tree -> exactly the team, on the same team).
   */
  narrower?: boolean;
  wider?: boolean;
}
export interface PersonImpact {
  userId: string;
  name: string;
  gained: PermissionDelta[];
  lost: PermissionDelta[];
  changed: PermissionDelta[];
}
export interface PreviewResult {
  /** Everybody the server looked at (not the number affected: that is `impacts.length`). */
  people: number;
  impacts: PersonImpact[];
  /** teamId -> name, for the team ids inside the deltas. */
  teamNames?: Record<string, string>;
}
/** What enforcing would change for every active person, against what their role gives today. */
export interface ModeComparison extends PreviewResult {
  /** People counted once per line: somebody who both gains and loses is in both. */
  summary: { affected: number; losing: number; gaining: number; changing: number };
  teamNames: Record<string, string>;
  /** Sent back when asking for or approving enforcement: proof of which comparison was read. */
  fingerprint: string;
}

/** One change of the mode, or one request to enforce. */
export interface ModeChange {
  id: string;
  fromMode: AuthzMode;
  toMode: AuthzMode;
  status: ModeChangeStatus;
  requestedById: string;
  requestedByName: string;
  reason: string;
  decidedById: string | null;
  decidedByName: string | null;
  /** ISO date-time. */
  decidedAt: string | null;
  createdAt: string;
  /** ISO date-time, only while PENDING. */
  expiresAt: string | null;
}
export interface ModeStatus {
  /** The mode an administrator chose. */
  mode: AuthzMode;
  /** Whether enforcement is in effect right now (the chosen mode may be ENFORCE without it). */
  enforcing: boolean;
  /** False = this build cannot enforce at all. */
  enforceAvailable: boolean;
  pending: ModeChange | null;
  history: ModeChange[];
}

export interface PreviewRequest {
  templates?: { id: string; entries: Entries | null }[];
  teams?: { teamId: string; config: TeamConfig | null }[];
  users?: { userId: string; overrides: Override[] }[];
}

export interface ChangeItem {
  type: ChangeType;
  id: string;
  before: unknown;
  after: unknown;
}
export interface ChangeSet {
  id: string;
  kind: string;
  actorId: string;
  actorName: string;
  reason: string | null;
  createdAt: string;
  revertsId: string | null;
  undoneById: string | null;
  changes: ChangeItem[];
}

export interface EffectiveGrant {
  reach: Reach;
  source: GrantSource;
  teamId: string | null;
  teamName: string | null;
  configTeamId: string | null;
  configTeamName: string | null;
  templateId: string | null;
  templateName: string | null;
  asLeader: boolean;
}
export interface EffectivePermission {
  permission: string;
  resource: string;
  reach: Reach | null;
  grants: EffectiveGrant[];
  mutedBy: { source: GrantSource; teamId: string | null; teamName: string | null }[];
  reaches: null | { all: boolean; own: boolean; teams: { id: string; name: string }[]; unassigned: boolean };
}
export interface EffectiveView {
  userId: string;
  mode: AuthzMode;
  admin: boolean;
  teams: { id: string; name: string }[];
  validUntil: string | null;
  permissions: EffectivePermission[];
}

/** A person's own overrides, with the token to send back when saving them (a stale one is a REVISION_CONFLICT). */
export interface UserOverrides {
  overrides: Override[];
  token: string;
}
export interface SaveUserOverridesBody {
  overrides: Override[];
  expectedToken: string;
  reason?: string;
}

/** Detail codes inside an AUTHZ_CHANGE_INVALID refusal. */
export const PROBLEM = {
  PERMISSION_UNKNOWN: 'PERMISSION_UNKNOWN',
  REACH_NOT_ALLOWED: 'REACH_NOT_ALLOWED',
  WIDER_THAN_VIEW: 'WIDER_THAN_VIEW',
  TEMPLATE_NAME_REQUIRED: 'TEMPLATE_NAME_REQUIRED',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_ARCHIVED: 'TEMPLATE_ARCHIVED',
  MEMBER_TEMPLATE_REQUIRED: 'MEMBER_TEMPLATE_REQUIRED',
  OVERRIDE_REASON_REQUIRED: 'OVERRIDE_REASON_REQUIRED',
  OVERRIDE_REACH_REQUIRED: 'OVERRIDE_REACH_REQUIRED',
  OVERRIDE_EXPIRED: 'OVERRIDE_EXPIRED',
  OVERRIDE_DUPLICATE: 'OVERRIDE_DUPLICATE',
  ABOVE_OWN: 'ABOVE_OWN',
  SENSITIVE_REASON_REQUIRED: 'SENSITIVE_REASON_REQUIRED',
} as const;
export type ProblemCode = (typeof PROBLEM)[keyof typeof PROBLEM];
export interface Problem {
  code: ProblemCode;
  permission?: string;
  reach?: Reach;
  view?: string;
  viewReach?: Reach | null;
  templateId?: string;
}

export interface WriteResult {
  changed: boolean;
  changeSetId: string | null;
  id?: string;
}

/** What "create the starter templates" did: the ones it made, and the codes that were already there. */
export interface StarterTemplatesResult extends WriteResult {
  created: { id: string; code: string }[];
  existing: string[];
}

export interface SaveTemplateBody {
  name: string;
  description: string | null;
  entries: Entries;
  reason?: string;
}
export interface SaveTeamBody extends TeamConfig {
  expectedRevision: number;
  reason?: string;
}
export interface ApplyTeamsBody {
  teamIds: string[];
  config: TeamConfig | null;
  expected: Record<string, number>;
  reason?: string;
}
