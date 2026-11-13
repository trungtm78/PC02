/** Shapes and constants of "permissions by team" (`/authz` on the server). Enum strings are declared once, here. */

export const REACH = { OWN: 'OWN', TEAM: 'TEAM', TEAM_TREE: 'TEAM_TREE', ALL: 'ALL' } as const;
export type Reach = (typeof REACH)[keyof typeof REACH];
/** Narrowest first. */
export const REACH_ORDER: readonly Reach[] = [REACH.OWN, REACH.TEAM, REACH.TEAM_TREE, REACH.ALL];
/** The three choices of the plain screen; "exactly this team" (TEAM) is an advanced one. */
export const PLAIN_REACHES: readonly Reach[] = [REACH.OWN, REACH.TEAM_TREE, REACH.ALL];

export const AUTHZ_MODE = { OFF: 'OFF', SHADOW: 'SHADOW', ENFORCE: 'ENFORCE' } as const;
export type AuthzMode = (typeof AUTHZ_MODE)[keyof typeof AUTHZ_MODE];

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
} as const;

export const PAGE_TAB = { TEMPLATES: 'templates', TEAMS: 'teams', LOOKUP: 'lookup', HISTORY: 'history' } as const;
export type PageTab = (typeof PAGE_TAB)[keyof typeof PAGE_TAB];
export const PAGE_TABS: readonly PageTab[] = [PAGE_TAB.TEMPLATES, PAGE_TAB.TEAMS, PAGE_TAB.LOOKUP, PAGE_TAB.HISTORY];
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
