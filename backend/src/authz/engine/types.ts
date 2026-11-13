import type { PermissionDepth } from '../../../prisma/permission-resources';

/** A reach that grants something (every depth but NONE). */
export type Reach = Exclude<PermissionDepth, 'NONE'>;

export interface OrgTeam {
  id: string;
  parentId: string | null;
  active: boolean;
  wardId: string | null;
}

/** The organisation as the engine needs it: teams, and who belongs to each. Built once per revision. */
export interface OrgSnapshot {
  teams: ReadonlyMap<string, OrgTeam>;
  /** Children of each team, active or not. */
  children: ReadonlyMap<string, readonly string[]>;
  /** Members of each team (user ids). */
  members: ReadonlyMap<string, readonly string[]>;
}

export interface OverrideInput {
  permission: string;
  effect: 'GRANT' | 'MUTE';
  /** The reach of a GRANT. */
  reach: Reach | null;
  expiresAt: Date | null;
}

export interface TeamConfigInput {
  teamId: string;
  mode: 'INHERIT' | 'EXPLICIT';
  memberTemplateId: string | null;
  leaderTemplateId: string | null;
  overrides: readonly (OverrideInput & { audience: 'ALL' | 'MEMBER' | 'LEADER' })[];
}

export interface TemplateInput {
  id: string;
  name: string;
  entries: ReadonlyMap<string, Reach>;
}

export interface AuthzConfig {
  teamConfigs: ReadonlyMap<string, TeamConfigInput>;
  templates: ReadonlyMap<string, TemplateInput>;
}

export interface UserInput {
  id: string;
  roleName: string;
  /** What the person's role holds: what they have wherever no team says otherwise. */
  rolePermissions: readonly string[];
  canDispatch: boolean;
  memberships: readonly { teamId: string; isLeader: boolean }[];
  overrides: readonly OverrideInput[];
  /** Data access grants: extra teams the person may read (READ) or read and change (WRITE). */
  dataGrants: readonly { teamId: string; level: 'READ' | 'WRITE'; expiresAt: Date | null }[];
}

/** Why a person has a grant: the words of "Tra cứu quyền" are made from this. */
export type GrantSource =
  | { kind: 'ROLE'; teamId: string | null }
  | { kind: 'TEMPLATE'; teamId: string; configTeamId: string; templateId: string; asLeader: boolean }
  | { kind: 'TEAM_OVERRIDE'; teamId: string; configTeamId: string }
  | { kind: 'USER_OVERRIDE' };

export interface Grant {
  reach: Reach;
  /** The team the reach is measured from; null = no team (a person in no team, or a per-user grant). */
  teamId: string | null;
  source: GrantSource;
}

export type MuteSource = { kind: 'TEAM_OVERRIDE'; teamId: string; configTeamId: string } | { kind: 'USER_OVERRIDE' };

export interface EffectivePermissions {
  userId: string;
  /** ADMIN: everything the role holds, unrestricted over records. */
  admin: boolean;
  /** Every permission the person has at any reach, as `action:subject`, sorted. What the guards and menus read. */
  keys: readonly string[];
  grants: ReadonlyMap<string, readonly Grant[]>;
  /** Permissions something would have given but an override took away, and what took them. */
  muted: ReadonlyMap<string, readonly MuteSource[]>;
  /** Teams of the person that count (active), in membership order. */
  activeTeamIds: readonly string[];
  wardTeamId: string | null;
  canDispatch: boolean;
  dataGrants: readonly { teamId: string; level: 'READ' | 'WRITE' }[];
  /** The earliest moment after `now` at which this answer changes by itself (an override or grant expiring). */
  validUntil: Date | null;
}

/** How far one permission reaches over records. */
export type RecordScope =
  | { all: true }
  | {
      all: false;
      /** Records the person owns. */
      own: boolean;
      /** Records assigned to exactly these teams. */
      exactTeamIds: string[];
      /** "As today": records of these teams or of these people, and (unless a ward officer) unassigned records. */
      tree: { teamIds: string[]; userIds: string[]; includeUnassigned: boolean } | null;
    };
