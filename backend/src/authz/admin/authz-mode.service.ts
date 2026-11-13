import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { AUTHZ_MODES, AuthzService, type AuthzMode, type AuthzSnapshot } from '../authz.service';
import { compile } from '../engine/compile';
import type { AuthzConfig, UserInput } from '../engine/types';
import { impactBetween, tokenOf, type PersonImpact } from './documents';
import { CONFIG_WRITE_LOCK } from './authz-admin.service';

type Tx = Prisma.TransactionClient;
type Meta = { ipAddress?: string; userAgent?: string };

export const AUTHZ_MODE_ERROR = {
  ADMIN_ONLY: 'AUTHZ_MODE_ADMIN_ONLY',
  REASON_REQUIRED: 'AUTHZ_MODE_REASON_REQUIRED',
  /** Enforcing is never a one-person switch: it is asked for, then approved by somebody else. */
  ENFORCE_NEEDS_REQUEST: 'AUTHZ_MODE_ENFORCE_NEEDS_REQUEST',
  ENFORCE_NOT_AVAILABLE: 'AUTHZ_MODE_ENFORCE_NOT_AVAILABLE',
  /** What would change for people is no longer what was read: read the comparison again. */
  COMPARISON_CHANGED: 'AUTHZ_MODE_COMPARISON_CHANGED',
  ALREADY: 'AUTHZ_MODE_ALREADY',
  REQUEST_PENDING: 'AUTHZ_MODE_REQUEST_PENDING',
  REQUEST_NOT_FOUND: 'AUTHZ_MODE_REQUEST_NOT_FOUND',
  REQUEST_NOT_PENDING: 'AUTHZ_MODE_REQUEST_NOT_PENDING',
  REQUEST_EXPIRED: 'AUTHZ_MODE_REQUEST_EXPIRED',
  SECOND_ADMIN_REQUIRED: 'AUTHZ_MODE_SECOND_ADMIN_REQUIRED',
  WOULD_LOCK_OUT: 'AUTHZ_MODE_WOULD_LOCK_OUT',
} as const;

/** A request to enforce that nobody approved within this time has to be made again, on a fresh comparison. */
export const MODE_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
/** What an administrator must still hold once permissions by team are enforced, to be able to switch them off. */
const TO_ADMINISTER = ['read:Role', 'write:Role'] as const;

const EMPTY_CONFIG: AuthzConfig = { templates: new Map(), teamConfigs: new Map() };

export interface Comparison {
  /** Everybody the configuration knows (active accounts). */
  people: number;
  summary: { affected: number; losing: number; gaining: number; changing: number };
  impacts: (PersonImpact & { name: string })[];
  teamNames: Record<string, string>;
  /** Equal exactly while enforcing would change the same things for the same people. */
  fingerprint: string;
}

export interface ModeChangeView {
  id: string;
  fromMode: string;
  toMode: string;
  status: string;
  requestedById: string;
  requestedByName: string;
  reason: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * The mode of permissions by team, and the only way to change it.
 *
 *   OFF / SHADOW  one administrator, at once, with a reason: going BACK must never wait for anybody.
 *   ENFORCE       two administrators. One asks, having read the comparison of who gains and loses what; another
 *                 approves, having read the same comparison. If the configuration, the teams or the people changed
 *                 in between, the comparison is another one and the approval is refused until it is read again.
 *
 * Nobody can enforce a configuration under which they, or the person who asked, could no longer open this screen.
 */
@Injectable()
export class AuthzModeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
  ) {}

  // ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────

  /** The mode as stored (what an administrator chose), which is not always the one in effect. */
  private async storedMode(client: Tx | PrismaService): Promise<AuthzMode> {
    const row = await client.systemSetting.findUnique({ where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO }, select: { value: true } });
    const value = row?.value as AuthzMode | undefined;
    return value && AUTHZ_MODES.includes(value) ? value : 'OFF';
  }

  private static compare(snapshot: AuthzSnapshot, now: Date): PersonImpact[] {
    // Today: the role alone decides, and nobody has a personal override. Enforced: the configuration as stored.
    const today = new Map<string, UserInput>();
    for (const [userId, person] of snapshot.users) today.set(userId, { ...person, overrides: [] });
    return impactBetween(snapshot.org, { config: EMPTY_CONFIG, users: today }, { config: snapshot.config, users: snapshot.users }, now);
  }

  private static fingerprintOf(impacts: readonly PersonImpact[]): string {
    return tokenOf([...impacts].sort((a, b) => a.userId.localeCompare(b.userId)));
  }

  /**
   * What enforcing would change, for every active person, against what they have today from their role. Computed
   * with the engine that will enforce, on the configuration in the database now.
   */
  async comparison(now: Date = new Date()): Promise<Comparison> {
    const snapshot = await this.authz.snapshot();
    const impacts = AuthzModeService.compare(snapshot, now);
    const names = await this.namesOf(impacts.map((i) => i.userId));
    const teamIds = new Set(impacts.flatMap((i) => [...i.gained, ...i.lost, ...i.changed].flatMap((d) => [...(d.teamsGained ?? []), ...(d.teamsLost ?? [])])));
    return {
      people: snapshot.users.size,
      summary: {
        affected: impacts.length,
        losing: impacts.filter((i) => i.lost.length > 0 || i.changed.some((d) => d.teamsLost?.length)).length,
        gaining: impacts.filter((i) => i.gained.length > 0 || i.changed.some((d) => d.teamsGained?.length)).length,
        changing: impacts.filter((i) => i.changed.length > 0).length,
      },
      impacts: impacts.map((i) => ({ ...i, name: names.get(i.userId) ?? i.userId })),
      teamNames: Object.fromEntries([...teamIds].map((id) => [id, snapshot.teamNames.get(id) ?? id])),
      fingerprint: AuthzModeService.fingerprintOf(impacts),
    };
  }

  private async namesOf(userIds: readonly string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, username: true, firstName: true, lastName: true },
    });
    return new Map(rows.map((u) => [u.id, [u.lastName, u.firstName].filter(Boolean).join(' ') || u.username]));
  }

  private async views(rows: readonly { id: string; fromMode: string; toMode: string; status: string; requestedById: string; reason: string; decidedById: string | null; decidedAt: Date | null; createdAt: Date }[]): Promise<ModeChangeView[]> {
    const names = await this.namesOf(rows.flatMap((r) => [r.requestedById, ...(r.decidedById ? [r.decidedById] : [])]));
    return rows.map((r) => ({
      id: r.id,
      fromMode: r.fromMode,
      toMode: r.toMode,
      status: r.status,
      requestedById: r.requestedById,
      requestedByName: names.get(r.requestedById) ?? r.requestedById,
      reason: r.reason,
      decidedById: r.decidedById,
      decidedByName: r.decidedById ? (names.get(r.decidedById) ?? r.decidedById) : null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.status === 'PENDING' ? new Date(r.createdAt.getTime() + MODE_REQUEST_TTL_MS).toISOString() : null,
    }));
  }

  /** The mode, whether it is in effect, the request awaiting a second administrator, and the recent changes. */
  async status(now: Date = new Date()) {
    const mode = await this.storedMode(this.prisma);
    const rows = await this.prisma.authzModeChange.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20 });
    const history = await this.views(rows);
    const live = (r: ModeChangeView) => r.status === 'PENDING' && new Date(r.expiresAt as string).getTime() > now.getTime();
    return {
      mode,
      /** ENFORCE only when the stored mode is ENFORCE, this build can enforce and the configuration is fresh. */
      enforcing: this.authz.state(now.getTime()) === 'ENFORCE',
      enforceAvailable: AuthzService.enforceAvailable,
      pending: history.find(live) ?? null,
      history,
    };
  }

  // ── changing ────────────────────────────────────────────────────────────────────────────────────────────────

  private static reasonOf(raw: string | null | undefined): string {
    const reason = raw?.trim() ?? '';
    if (!reason) throw new BadRequestException({ code: AUTHZ_MODE_ERROR.REASON_REQUIRED });
    return reason;
  }

  /** Administrators only, judged from the configuration in the database (not from what a token says). */
  private static assertAdministrator(snapshot: AuthzSnapshot, userId: string, now: Date): void {
    const person = snapshot.users.get(userId);
    if (!person || !compile(snapshot.org, snapshot.config, person, now).admin) {
      throw new ForbiddenException({ code: AUTHZ_MODE_ERROR.ADMIN_ONLY });
    }
  }

  /** Enforced, each of these people must still be able to open this screen and switch enforcement off. */
  private static assertNoLockOut(snapshot: AuthzSnapshot, userIds: readonly string[], now: Date): void {
    for (const userId of userIds) {
      const person = snapshot.users.get(userId);
      const keys = person ? compile(snapshot.org, snapshot.config, person, now).keys : [];
      if (!TO_ADMINISTER.every((key) => keys.includes(key))) {
        throw new ConflictException({ code: AUTHZ_MODE_ERROR.WOULD_LOCK_OUT, details: [{ userId }] });
      }
    }
  }

  /** The snapshot to judge from, and the proof that it still describes the database inside the write transaction. */
  private async judged(): Promise<AuthzSnapshot> {
    await this.authz.refresh();
    return this.authz.snapshot();
  }

  private async assertStill(tx: Tx, snapshot: AuthzSnapshot): Promise<void> {
    const rows = await tx.$queryRaw<{ n: bigint; last: bigint }[]>`
      SELECT count(*)::bigint AS n, coalesce(max("id"), 0)::bigint AS last FROM "authz_changes"`;
    if (`${rows[0].n}:${rows[0].last}` !== snapshot.revision) {
      throw new ConflictException({ code: AUTHZ_MODE_ERROR.COMPARISON_CHANGED });
    }
  }

  private async write(tx: Tx, mode: AuthzMode): Promise<void> {
    await tx.systemSetting.upsert({
      where: { key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO },
      update: { value: mode },
      create: {
        key: SETTINGS_KEY.QUYEN_THEO_TO_CHE_DO,
        value: mode,
        label: 'Phân quyền theo tổ: OFF (theo vai trò như cũ), SHADOW (tính song song để so sánh), ENFORCE (áp dụng)',
      },
    });
  }

  private pendingIn(tx: Tx, now: Date) {
    return tx.authzModeChange.findFirst({
      where: { status: 'PENDING', createdAt: { gt: new Date(now.getTime() - MODE_REQUEST_TTL_MS) } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private log(tx: Tx, actorId: string, action: string, changeId: string, metadata: Record<string, unknown>, meta?: Meta) {
    // Metadata only: modes, ids, the fingerprint. Never who gains or loses what.
    return this.audit.log(
      { userId: actorId, action, subject: 'Role', subjectId: changeId, metadata, ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
      tx,
    );
  }

  /** Back to OFF, or to SHADOW: one administrator, at once. A request to enforce that was waiting lapses. */
  async set(actorId: string, mode: AuthzMode, rawReason: string, meta?: Meta, now: Date = new Date()): Promise<{ id: string; mode: AuthzMode }> {
    if (mode === 'ENFORCE') throw new BadRequestException({ code: AUTHZ_MODE_ERROR.ENFORCE_NEEDS_REQUEST });
    const reason = AuthzModeService.reasonOf(rawReason);
    AuthzModeService.assertAdministrator(await this.judged(), actorId, now);
    const id = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONFIG_WRITE_LOCK})`;
      const from = await this.storedMode(tx);
      if (from === mode) throw new ConflictException({ code: AUTHZ_MODE_ERROR.ALREADY });
      await tx.authzModeChange.updateMany({ where: { status: 'PENDING' }, data: { status: 'SUPERSEDED', decidedById: actorId, decidedAt: now } });
      await this.write(tx, mode);
      const row = await tx.authzModeChange.create({
        data: { fromMode: from, toMode: mode, status: 'APPLIED', requestedById: actorId, reason, decidedById: actorId, decidedAt: now },
      });
      await this.log(tx, actorId, 'AUTHZ_MODE_CHANGED', row.id, { from, to: mode }, meta);
      return row.id;
    });
    await this.authz.refresh();
    return { id, mode };
  }

  /** Asks for enforcement. `acknowledge` is the fingerprint of the comparison the asker read. */
  async requestEnforce(actorId: string, rawReason: string, acknowledge: string, meta?: Meta, now: Date = new Date()): Promise<{ id: string }> {
    if (!AuthzService.enforceAvailable) throw new ConflictException({ code: AUTHZ_MODE_ERROR.ENFORCE_NOT_AVAILABLE });
    const reason = AuthzModeService.reasonOf(rawReason);
    const snapshot = await this.judged();
    AuthzModeService.assertAdministrator(snapshot, actorId, now);
    const fingerprint = AuthzModeService.fingerprintOf(AuthzModeService.compare(snapshot, now));
    if (acknowledge !== fingerprint) throw new ConflictException({ code: AUTHZ_MODE_ERROR.COMPARISON_CHANGED });
    AuthzModeService.assertNoLockOut(snapshot, [actorId], now);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONFIG_WRITE_LOCK})`;
      await this.assertStill(tx, snapshot);
      const from = await this.storedMode(tx);
      if (from === 'ENFORCE') throw new ConflictException({ code: AUTHZ_MODE_ERROR.ALREADY });
      if (await this.pendingIn(tx, now)) throw new ConflictException({ code: AUTHZ_MODE_ERROR.REQUEST_PENDING });
      const row = await tx.authzModeChange.create({
        data: { fromMode: from, toMode: 'ENFORCE', status: 'PENDING', requestedById: actorId, reason, fingerprint, createdAt: now },
      });
      await this.log(tx, actorId, 'AUTHZ_MODE_REQUESTED', row.id, { from, to: 'ENFORCE', fingerprint }, meta);
      return { id: row.id };
    });
  }

  /** A SECOND administrator, having read the same comparison, switches enforcement on. */
  async approve(requestId: string, actorId: string, acknowledge: string, meta?: Meta, now: Date = new Date()): Promise<{ id: string; mode: AuthzMode }> {
    if (!AuthzService.enforceAvailable) throw new ConflictException({ code: AUTHZ_MODE_ERROR.ENFORCE_NOT_AVAILABLE });
    const snapshot = await this.judged();
    AuthzModeService.assertAdministrator(snapshot, actorId, now);
    const fingerprint = AuthzModeService.fingerprintOf(AuthzModeService.compare(snapshot, now));
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONFIG_WRITE_LOCK})`;
      const row = await tx.authzModeChange.findUnique({ where: { id: requestId } });
      if (!row) throw new NotFoundException({ code: AUTHZ_MODE_ERROR.REQUEST_NOT_FOUND });
      if (row.status !== 'PENDING') throw new ConflictException({ code: AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING });
      if (row.createdAt.getTime() + MODE_REQUEST_TTL_MS <= now.getTime()) throw new ConflictException({ code: AUTHZ_MODE_ERROR.REQUEST_EXPIRED });
      if (row.requestedById === actorId) throw new ForbiddenException({ code: AUTHZ_MODE_ERROR.SECOND_ADMIN_REQUIRED });
      // The asker must still be an administrator: a request left behind by somebody who no longer is one is void.
      AuthzModeService.assertAdministrator(snapshot, row.requestedById, now);
      await this.assertStill(tx, snapshot);
      // Both read THIS comparison: the one asked on, the one acknowledged now, and the one the database gives now.
      if (row.fingerprint !== fingerprint || acknowledge !== fingerprint) {
        throw new ConflictException({ code: AUTHZ_MODE_ERROR.COMPARISON_CHANGED });
      }
      AuthzModeService.assertNoLockOut(snapshot, [actorId, row.requestedById], now);
      const from = await this.storedMode(tx);
      if (from === 'ENFORCE') throw new ConflictException({ code: AUTHZ_MODE_ERROR.ALREADY });
      await this.write(tx, 'ENFORCE');
      await tx.authzModeChange.update({ where: { id: row.id }, data: { status: 'APPLIED', fromMode: from, decidedById: actorId, decidedAt: now } });
      await this.log(tx, actorId, 'AUTHZ_MODE_CHANGED', row.id, { from, to: 'ENFORCE', fingerprint, requestedById: row.requestedById }, meta);
    });
    await this.authz.refresh();
    return { id: requestId, mode: 'ENFORCE' };
  }

  /** The way back from a request: the asker withdraws it, another administrator rejects it. */
  async close(requestId: string, actorId: string, meta?: Meta, now: Date = new Date()): Promise<{ id: string; status: string }> {
    AuthzModeService.assertAdministrator(await this.judged(), actorId, now);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONFIG_WRITE_LOCK})`;
      const row = await tx.authzModeChange.findUnique({ where: { id: requestId } });
      if (!row) throw new NotFoundException({ code: AUTHZ_MODE_ERROR.REQUEST_NOT_FOUND });
      if (row.status !== 'PENDING') throw new ConflictException({ code: AUTHZ_MODE_ERROR.REQUEST_NOT_PENDING });
      const status = row.requestedById === actorId ? 'WITHDRAWN' : 'REJECTED';
      await tx.authzModeChange.update({ where: { id: row.id }, data: { status, decidedById: actorId, decidedAt: now } });
      await this.log(tx, actorId, 'AUTHZ_MODE_REQUEST_CLOSED', row.id, { status }, meta);
      return { id: row.id, status };
    });
  }
}
