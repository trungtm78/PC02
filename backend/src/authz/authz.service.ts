import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
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
/** How long after one background refresh ends the next one starts. */
export const REFRESH_EVERY_MS = 3_000;
/** A refresh that has not finished by then is given up (its result, if it ever comes, is not used). */
export const REFRESH_TIMEOUT_MS = 10_000;
/**
 * While ENFORCING, a configuration last confirmed longer ago than this is not trusted any more: requests are refused
 * instead of being answered from permissions that may have been taken away since.
 */
export const MAX_SNAPSHOT_AGE_MS = 60_000;

/**
 * What the request path may assume right now.
 *   OFF          not enforcing (the mode is OFF or SHADOW): roles decide, as before
 *   ENFORCE      enforcing, from a configuration confirmed recently
 *   UNAVAILABLE  it cannot be told, or the configuration is too old: nothing may be decided from it
 */
export type AuthzState = 'OFF' | 'ENFORCE' | 'UNAVAILABLE';

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
export class AuthzService implements OnApplicationBootstrap, OnModuleDestroy {
  private snapshotCache: AuthzSnapshot | null = null;
  private loading: Promise<AuthzSnapshot> | null = null;
  private readonly effectiveCache = new Map<string, EffectivePermissions>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private refreshing: Promise<void> | null = null;
  /** When the configuration in memory was last confirmed against the database. */
  private confirmedAt: number | null = null;
  /** With nothing in memory: whether the mode itself could be read and is not ENFORCE. */
  private knownNotEnforcing = false;

  /**
   * Whether the mode ENFORCE may take effect at all. While false, ENFORCE in the database is treated as SHADOW.
   *
   * True since every place that decides what a person may do asks permissions by team first: the route guard,
   * `/auth/me`, the request scope and the record filters, the services that check a permission themselves
   * (`role-readers.gate.spec.ts`) and the checks that were written against a role name (`role-names.gate.spec.ts`),
   * proven together on PostgreSQL in `enforce-end-to-end.database.spec.ts`. A build that must not enforce whatever
   * the database says (an emergency) sets this to false: one line, no migration.
   *
   * The mode itself is switched only through `AuthzModeService`: two administrators, on a comparison both read.
   */
  static enforceAvailable = true;
  private readonly logger = new Logger(AuthzService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The configuration is loaded BEFORE the application takes requests and then kept fresh in the background, so the
   * request path only ever reads memory (`cached()`): it never waits on the database for this, in any mode, and
   * takes no connection (the scope is also asked for inside open transactions).
   *
   * A change is noticed within `REFRESH_EVERY_MS`; the save path of the permission screen refreshes at once.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.refresh();
    this.schedule();
  }

  /** The next refresh starts only after the previous one has ended: refreshes never pile up behind a slow database. */
  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.refresh().finally(() => this.schedule());
    }, REFRESH_EVERY_MS);
    // Never keeps the process alive on its own (tests, shutdown).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Brings the configuration in memory up to date. One at a time (callers arriving meanwhile wait for the same
   * one), bounded in time, and it never throws: a failed or overdue read keeps what is in memory, and
   * `state()` stops trusting it once it is too old.
   */
  refresh(): Promise<void> {
    this.refreshing ??= this.refreshOnce().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refreshOnce(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.snapshot(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`no answer within ${REFRESH_TIMEOUT_MS} ms`)), REFRESH_TIMEOUT_MS);
          timer.unref?.();
        }),
      ]);
      this.confirmedAt = Date.now();
    } catch (err) {
      this.logger.error(`Permission configuration could not be refreshed: ${err instanceof Error ? err.message : String(err)}`);
      // A load that hangs must not block every later one; its result, if it ever comes, is dropped by `publish`.
      this.loading = null;
      if (!this.snapshotCache) await this.confirmNotEnforcing();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** With nothing in memory, the one thing worth knowing is whether anything is being enforced at all. */
  private async confirmNotEnforcing(): Promise<void> {
    if (!AuthzService.enforceAvailable) {
      this.knownNotEnforcing = true;
      return;
    }
    try {
      const row = await this.prisma.systemSetting.findUnique({
        where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO },
        select: { value: true },
      });
      this.knownNotEnforcing = row?.value !== 'ENFORCE';
    } catch {
      this.knownNotEnforcing = false;
    }
  }

  /** See `AuthzState`. Synchronous, from memory. */
  state(now: number = Date.now()): AuthzState {
    const snapshot = this.snapshotCache;
    if (!snapshot) return this.knownNotEnforcing ? 'OFF' : 'UNAVAILABLE';
    if (snapshot.mode !== 'ENFORCE') return 'OFF';
    return this.confirmedAt !== null && now - this.confirmedAt <= MAX_SNAPSHOT_AGE_MS ? 'ENFORCE' : 'UNAVAILABLE';
  }

  /** The configuration in memory, or null when it has never been loaded. Synchronous: what the request path reads. */
  cached(): AuthzSnapshot | null {
    return this.snapshotCache;
  }

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
    this.publish(loaded);
    return loaded;
  }

  /**
   * Puts a loaded snapshot in memory unless what is there is newer (a load given up for being slow may still finish,
   * long after a later one). The revision starts with the number of logged changes, which only grows.
   */
  private publish(loaded: AuthzSnapshot): void {
    const changes = (s: AuthzSnapshot) => Number(s.revision.split(':')[0]);
    if (this.snapshotCache === loaded) return;
    if (this.snapshotCache && changes(loaded) < changes(this.snapshotCache)) return;
    this.snapshotCache = loaded;
    this.effectiveCache.clear();
  }

  async mode(): Promise<AuthzMode> {
    return (await this.snapshot()).mode;
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
        select: { id: true, name: true, permissions: { select: { permission: { select: { action: true, subject: true, conditions: true } } } } },
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

    const roleOf = new Map(
      roles.map((r) => [
        r.id,
        {
          name: r.name,
          permissions: r.permissions.map((p) => pair(p.permission)),
          conditional: r.permissions.filter((p) => p.permission.conditions !== null).map((p) => pair(p.permission)),
        },
      ]),
    );
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
            conditionalRolePermissions: role?.conditional ?? [],
            canDispatch: u.canDispatch,
            memberships: membershipsOf.get(u.id) ?? [],
            overrides: overridesOf.get(u.id) ?? [],
            dataGrants: grantsOf.get(u.id) ?? [],
          },
        ];
      }),
    );

    const value = modeRow?.value as AuthzMode | undefined;
    // Anything that is not one of the three words is OFF: a typo must never switch enforcement on.
    let mode: AuthzMode = value && AUTHZ_MODES.includes(value) ? value : 'OFF';
    if (mode === 'ENFORCE' && !AuthzService.enforceAvailable) {
      this.logger.warn('The mode is ENFORCE but enforcement is not available in this build: running as SHADOW.');
      mode = 'SHADOW';
    }
    return {
      revision,
      mode,
      org: { teams: orgTeams, children, members },
      config: { teamConfigs, templates: templateMap },
      users: userMap,
      teamNames: new Map(teams.map((t) => [t.id, t.name])),
      templateNames: new Map(templates.map((t) => [t.id, t.name])),
    };
  }
}
