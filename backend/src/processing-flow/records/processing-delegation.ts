import type { Prisma } from '@prisma/client';

type Reader = Pick<Prisma.TransactionClient, 'procDelegation' | 'user'>;

/** Vietnam has no daylight saving: a civil day there starts seven hours before the same date in UTC. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/**
 * A delegation in force at `now`: not revoked, and `now` within its two instants (both inclusive). `now` is always the
 * APPLICATION clock; the database's own clock is never asked.
 */
export function delegationInForce(now: Date): Prisma.ProcDelegationWhereInput {
  return { revokedAt: null, validFrom: { lte: now }, validTo: { gte: now } };
}

/** One person this user acts for right now, and until when. */
export interface ActingFor {
  fromUserId: string;
  until: Date;
}

/**
 * The people `userId` acts for at `now`: the from-users of the delegations in force that name them as the delegate.
 *
 * A delegation counts only while the from-user is still an ACTIVE account: the work of a person whose account was
 * closed is to be given to somebody by a head, not inherited through a paper that outlived its author.
 *
 * What it gives is the STEP rule and nothing else: wherever a party of a step names the from-user, or a unit the
 * from-user belongs to (or heads), the delegate counts as that person for that step. It never lends the from-user's
 * permissions, team memberships or data scope.
 */
export async function actingFor(db: Reader, userId: string, now: Date): Promise<ActingFor[]> {
  if (!userId) return [];
  const rows = await db.procDelegation.findMany({ where: { toUserId: userId, ...delegationInForce(now) }, select: { fromUserId: true, validTo: true }, orderBy: { validFrom: 'asc' } });
  if (rows.length === 0) return [];
  const active = await db.user.findMany({ where: { id: { in: rows.map((row) => row.fromUserId) }, isActive: true }, select: { id: true } });
  const alive = new Set(active.map((user) => user.id));
  return rows.filter((row) => alive.has(row.fromUserId) && row.fromUserId !== userId).map((row) => ({ fromUserId: row.fromUserId, until: row.validTo }));
}

/** The ids only. */
export async function actingForIds(db: Reader, userId: string, now: Date): Promise<string[]> {
  return [...new Set((await actingFor(db, userId, now)).map((row) => row.fromUserId))];
}

/** The delegate of each of these people at `now` (a person has at most one: delegations of one person never overlap). */
export async function delegatesOf(db: Reader, fromUserIds: string[], now: Date): Promise<Map<string, { toUserId: string; until: Date }>> {
  const ids = [...new Set(fromUserIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.procDelegation.findMany({ where: { fromUserId: { in: ids }, ...delegationInForce(now) }, select: { fromUserId: true, toUserId: true, validTo: true } });
  return new Map(rows.map((row) => [row.fromUserId, { toUserId: row.toUserId, until: row.validTo }]));
}

/** `YYYY-MM-DD` as a civil day in Vietnam: its first instant and its last millisecond. `null` when it is no real date. */
export function vietnamDay(value: unknown): { start: Date; end: Date } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(year, month - 1, day);
  const back = new Date(utc);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  const start = utc - VIETNAM_OFFSET_MS;
  return { start: new Date(start), end: new Date(start + DAY_MS - 1) };
}
