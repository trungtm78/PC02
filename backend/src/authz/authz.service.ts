import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { compile } from './engine/compile';
import type {
  AuthzConfig,
  EffectivePermissions,
  OrgSnapshot,
  OrgTeam,
  OverrideInput,
  Reach,
  TeamConfigInput,
  TemplateInput,
  UserInput,
} from './engine/types';

export const AUTHZ_MODES = ['OFF', 'SHADOW', 'ENFORCE'] as const;
export type AuthzMode = (typeof AUTHZ_MODES)[number];
/** How long the request path trusts the mode it last read. */
export const MODE_TTL_MS = 10_000;

/** Everything effective permissions are computed from, as it was at one revision of the counter. */
export interface AuthzSnapshot {
  /** Opaque: equal while nothing changed. */
  revision: string;
  mode: AuthzMode;
  org: OrgSnapshot;
  config: AuthzConfig;
  users: ReadonlyMap<string, UserInput>;
  teamNames: ReadonlyMap<string, string>;
  templateNames: ReadonlyMap<string, string>;
}

const pair = (p: { action: string; subject: string }) => `${p.action}:${p.subject}`;
const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => map.set(key, [...(map.get(key) ?? []), value]);

/**
 * Reads the permission configuration and answers "what may this person do".
 *
 * Nothing in the request path uses this yet: the route guards and the record filters still read the role, exactly as
 * before (mode OFF). What it serves today is the admin's look-up of what a person WOULD have, and the comparison
 * report that must be read before anything is enforced.
 *
 * The whole configuration is small (a few hundred teams and people), so it is read at once and kept until the
 * database's revision counter moves; a person's answer is kept no longer than its own `validUntil`.
 */
@Injectable()
export class AuthzService {
  private snapshotCache: AuthzSnapshot | null = null;
  private loading: Promise<AuthzSnapshot> | null = null;
  private readonly effectiveCache = new Map<string, EffectivePermissions>();
  private modeCache: { mode: AuthzMode; readAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * What the triggers have logged, as far as this connection can see: the number of rows and the last one. A change
   * becomes visible here exactly when it is committed, so data read after seeing a revision is at least that new.
   * (The count alone would do; the last id makes the value readable.)
   */
  async revision(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ n: bigint; last: bigint }[]>`
      SELECT count(*)::bigint AS n, coalesce(max("id"), 0)::bigint AS last FROM "authz_changes"`;
    return `${rows[0].n}:${rows[0].last}`;
  }

  async snapshot(): Promise<AuthzSnapshot> {
    const revision = await this.revision();
    if (this.snapshotCache?.revision === revision) return this.snapshotCache;
    // One load at a time: requests arriving together after a change wait for the same read.
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    const loaded = await this.loading;
    if (this.snapshotCache !== loaded) {
      this.snapshotCache = loaded;
      this.effectiveCache.clear();
    }
    return loaded;
  }

  async mode(): Promise<AuthzMode> {
    return (await this.snapshot()).mode;
  }

  /**
   * The mode, for the request path: one indexed row, remembered for a few seconds, and NOTHING else. While the
   * mode is OFF a request must not depend on the permission configuration being readable at all.
   *
   * If the setting cannot be read, the last mode known is kept; with none known the mode is OFF (the process
   * has just started and cannot read its settings: nothing was being enforced by it).
   */
  async currentMode(now: number = Date.now()): Promise<AuthzMode> {
    if (this.modeCache && now - this.modeCache.readAt < MODE_TTL_MS) return this.modeCache.mode;
    try {
      const row = await this.prisma.systemSetting.findUnique({
        where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO },
        select: { value: true },
      });
      const value = row?.value as AuthzMode | undefined;
      this.modeCache = { mode: value && AUTHZ_MODES.includes(value) ? value : 'OFF', readAt: now };
    } catch {
      this.modeCache = { mode: this.modeCache?.mode ?? 'OFF', readAt: now };
    }
    return this.modeCache.mode;
  }

  /** What the person may do at `now`. Unknown or switched-off people are not found. */
  async effective(userId: string, now: Date = new Date()): Promise<EffectivePermissions> {
    return this.effectiveIn(await this.snapshot(), userId, now);
  }

  /**
   * The same, against a snapshot the caller already holds: whoever also reads teams or names from the snapshot must
   * get the person's answer from THAT snapshot, or the two could describe different moments.
   */
  effectiveIn(snapshot: AuthzSnapshot, userId: string, now: Date = new Date()): EffectivePermissions {
    const current = snapshot === this.snapshotCache;
    const cached = current ? this.effectiveCache.get(userId) : undefined;
    if (cached && (cached.validUntil === null || cached.validUntil.getTime() > now.getTime())) return cached;
    const user = snapshot.users.get(userId);
    if (!user) throw new NotFoundException({ code: 'AUTHZ_USER_NOT_FOUND' });
    const effective = compile(snapshot.org, snapshot.config, user, now);
    if (current) this.effectiveCache.set(userId, effective);
    return effective;
  }

  private async load(): Promise<AuthzSnapshot> {
    // The revision is read FIRST: a change committed during the reads below leaves a snapshot labelled older than
    // it is, which the next call replaces; the other order could label stale data as current and keep it.
    const revision = await this.revision();
    const [teams, memberships, configs, templates, roles, users, userOverrides, dataGrants, modeRow] = await Promise.all([
      this.prisma.team.findMany({ select: { id: true, name: true, parentId: true, status: true, wardId: true } }),
      this.prisma.userTeam.findMany({ select: { userId: true, teamId: true, isLeader: true }, orderBy: { joinedAt: 'asc' } }),
      this.prisma.teamPermissionConfig.findMany({
        include: { overrides: { include: { permission: { select: { action: true, subject: true } } } } },
      }),
      this.prisma.permissionTemplate.findMany({
        select: { id: true, name: true, entries: { select: { reach: true, permission: { select: { action: true, subject: true } } } } },
      }),
      this.prisma.role.findMany({
        select: { id: true, name: true, permissions: { select: { permission: { select: { action: true, subject: true } } } } },
      }),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, roleId: true, canDispatch: true } }),
      this.prisma.userPermissionOverride.findMany({ include: { permission: { select: { action: true, subject: true } } } }),
      this.prisma.dataAccessGrant.findMany({ select: { granteeId: true, teamId: true, accessLevel: true, expiresAt: true } }),
      this.prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO }, select: { value: true } }),
    ]);

    const orgTeams = new Map<string, OrgTeam>();
    const children = new Map<string, string[]>();
    for (const t of teams) {
      orgTeams.set(t.id, { id: t.id, parentId: t.parentId, active: t.status === 'ACTIVE', wardId: t.wardId });
      if (t.parentId) push(children, t.parentId, t.id);
    }
    const members = new Map<string, string[]>();
    const membershipsOf = new Map<string, { teamId: string; isLeader: boolean }[]>();
    for (const m of memberships) {
      push(members, m.teamId, m.userId);
      push(membershipsOf, m.userId, { teamId: m.teamId, isLeader: m.isLeader });
    }

    const teamConfigs = new Map<string, TeamConfigInput>(
      configs.map((c) => [
        c.teamId,
        {
          teamId: c.teamId,
          mode: c.mode,
          memberTemplateId: c.memberTemplateId,
          leaderTemplateId: c.leaderTemplateId,
          overrides: c.overrides.map((o) => ({
            permission: pair(o.permission),
            effect: o.effect,
            reach: o.reach as Reach | null,
            expiresAt: o.expiresAt,
            audience: o.audience,
          })),
        },
      ]),
    );
    const templateMap = new Map<string, TemplateInput>(
      templates.map((t) => [t.id, { id: t.id, name: t.name, entries: new Map(t.entries.map((e) => [pair(e.permission), e.reach as Reach])) }]),
    );

    const roleOf = new Map(roles.map((r) => [r.id, { name: r.name, permissions: r.permissions.map((p) => pair(p.permission)) }]));
    const overridesOf = new Map<string, OverrideInput[]>();
    for (const o of userOverrides) {
      push(overridesOf, o.userId, { permission: pair(o.permission), effect: o.effect, reach: o.reach as Reach | null, expiresAt: o.expiresAt });
    }
    const grantsOf = new Map<string, UserInput['dataGrants'][number][]>();
    for (const g of dataGrants) push(grantsOf, g.granteeId, { teamId: g.teamId, level: g.accessLevel, expiresAt: g.expiresAt });

    const userMap = new Map<string, UserInput>(
      users.map((u) => {
        const role = roleOf.get(u.roleId);
        return [
          u.id,
          {
            id: u.id,
            roleName: role?.name ?? '',
            rolePermissions: role?.permissions ?? [],
            canDispatch: u.canDispatch,
            memberships: membershipsOf.get(u.id) ?? [],
            overrides: overridesOf.get(u.id) ?? [],
            dataGrants: grantsOf.get(u.id) ?? [],
          },
        ];
      }),
    );

    const value = modeRow?.value as AuthzMode | undefined;
    return {
      revision,
      // Anything that is not one of the three words is OFF: a typo must never switch enforcement on.
      mode: value && AUTHZ_MODES.includes(value) ? value : 'OFF',
      org: { teams: orgTeams, children, members },
      config: { teamConfigs, templates: templateMap },
      users: userMap,
      teamNames: new Map(teams.map((t) => [t.id, t.name])),
      templateNames: new Map(templates.map((t) => [t.id, t.name])),
    };
  }
}
