import type { Prisma } from '@prisma/client';

type Reader = Pick<Prisma.TransactionClient, 'procDelegation' | 'user' | 'userTeam'>;

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

/** A delegation that gives something right now. */
export interface EffectiveDelegation {
  fromUserId: string;
  toUserId: string;
  until: Date;
}

/**
 * THE resolver of the delegations that give something at `now`; `actingFor`, `delegatesOf` and everything built on them
 * ask here and nowhere else. A delegation is effective when
 *
 *   - it is in force at `now` (the application clock) and not revoked, and
 *   - BOTH accounts are still ACTIVE, and
 *   - the two people still share at least one ACTIVE unit: what made the delegate eligible when it was created must
 *     still hold when it is used. A delegate who left the unit, a unit that was stopped or archived, a closed account:
 *     the delegation gives nothing, and gives again if the condition comes back within its days.
 *
 * Three queries whatever the number of delegations: the rows, the active accounts, the memberships in active units.
 */
export async function effectiveDelegations(db: Reader, where: Prisma.ProcDelegationWhereInput, now: Date): Promise<EffectiveDelegation[]> {
  const rows = await db.procDelegation.findMany({
    where: { AND: [where, delegationInForce(now)] },
    select: { fromUserId: true, toUserId: true, validTo: true },
    orderBy: [{ validFrom: 'asc' }, { id: 'asc' }],
  });
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((row) => [row.fromUserId, row.toUserId]))];
  const [people, memberships] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } }),
    db.userTeam.findMany({ where: { userId: { in: ids }, team: { status: 'ACTIVE' } }, select: { userId: true, teamId: true } }),
  ]);
  const active = new Set(people.map((person) => person.id));
  const unitsOf = new Map<string, Set<string>>();
  for (const membership of memberships) unitsOf.set(membership.userId, (unitsOf.get(membership.userId) ?? new Set<string>()).add(membership.teamId));
  const share = (a: string, b: string): boolean => [...(unitsOf.get(a) ?? [])].some((teamId) => unitsOf.get(b)?.has(teamId) === true);
  return rows
    .filter((row) => row.fromUserId !== row.toUserId && active.has(row.fromUserId) && active.has(row.toUserId) && share(row.fromUserId, row.toUserId))
    .map((row) => ({ fromUserId: row.fromUserId, toUserId: row.toUserId, until: row.validTo }));
}

/** One person this user acts for right now, and until when. */
export interface ActingFor {
  fromUserId: string;
  until: Date;
}

/**
 * The people `userId` acts for at `now`: the from-users of the EFFECTIVE delegations that name them as the delegate
 * (`effectiveDelegations`: in force, both accounts active, the two still in one active unit).
 *
 * What it gives is the STEP rule and nothing else: wherever a party of a step names the from-user, or a unit the
 * from-user belongs to (or heads), the delegate counts as that person for that step. It never lends the from-user's
 * permissions, team memberships or data scope.
 */
export async function actingFor(db: Reader, userId: string, now: Date): Promise<ActingFor[]> {
  if (!userId) return [];
  return (await effectiveDelegations(db, { toUserId: userId }, now)).map((row) => ({ fromUserId: row.fromUserId, until: row.until }));
}

/** The ids only. */
export async function actingForIds(db: Reader, userId: string, now: Date): Promise<string[]> {
  return [...new Set((await actingFor(db, userId, now)).map((row) => row.fromUserId))];
}

/** The delegate of each of these people at `now` (a person has at most one: delegations of one person never overlap). */
export async function delegatesOf(db: Reader, fromUserIds: string[], now: Date): Promise<Map<string, { toUserId: string; until: Date }>> {
  const ids = [...new Set(fromUserIds)];
  if (ids.length === 0) return new Map();
  const rows = await effectiveDelegations(db, { fromUserId: { in: ids } }, now);
  return new Map(rows.map((row) => [row.fromUserId, { toUserId: row.toUserId, until: row.until }]));
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
