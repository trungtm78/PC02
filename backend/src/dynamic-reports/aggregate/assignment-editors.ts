import { Prisma } from '@prisma/client';
import { freezeOwnedFieldKeys } from './contributors';

/**
 * Who may type into a period's assignment.
 *
 * The input screen and every write to a submission are decided by the assignment's own editor rows
 * (`DynReportAssignmentEditor`), not by the report's configuration (`DynReportTargetEditor`). The scheduler copies the
 * configured editors when it makes a period, so something has to keep the two in step afterwards:
 *
 * - a period that has not opened has nothing in progress, so it follows the configuration (`reconcileAssignmentEditors`);
 * - a period that is running keeps the editors it started with (D09) and changes them only through the mid-period
 *   action, with a reason (`applyAssignmentEditors` called from `AggregateService.setAssignmentEditors`).
 *
 * Nothing is deleted: an editor who leaves keeps the row, inactive, with the date, the reason and who did it.
 */

type Tx = Prisma.TransactionClient;

export interface EditorChangeContext {
  now: Date;
  /** Stored as `replaceReason` on every row this change ends. */
  reason: string;
  actorId?: string | null;
}

export interface EditorChangeResult {
  added: number;
  ended: number;
}

/** A person who may be named as an editor: active, and their role can open the module (`read:DynamicReport`). */
const QUALIFIED_USER = {
  isActive: true,
  role: {
    permissions: {
      some: { permission: { action: 'read', subject: 'DynamicReport' } },
    },
  },
} as const;

const inWindow = (now: Date) => ({
  validFrom: { lte: now },
  OR: [{ validTo: null }, { validTo: { gt: now } }],
});

/**
 * Makes the active editors of ONE assignment exactly `wanted`: adds the missing ones, ends the ones not wanted.
 * Asking for what is already in force changes nothing.
 */
export async function applyAssignmentEditors(
  tx: Tx,
  assignmentId: string,
  wanted: ReadonlySet<string>,
  ctx: EditorChangeContext,
): Promise<EditorChangeResult> {
  const current = await tx.dynReportAssignmentEditor.findMany({
    where: { assignmentId, isActive: true },
    select: { id: true, userId: true },
  });
  const have = new Set(current.map((row) => row.userId));

  const toEnd = current.filter((row) => !wanted.has(row.userId));
  if (toEnd.length > 0) {
    await tx.dynReportAssignmentEditor.updateMany({
      where: { id: { in: toEnd.map((row) => row.id) } },
      data: {
        isActive: false,
        replacedAt: ctx.now,
        replacedById: ctx.actorId ?? null,
        replaceReason: ctx.reason,
      },
    });
  }
  const toAdd = [...wanted].filter((userId) => !have.has(userId));
  if (toAdd.length > 0) {
    await tx.dynReportAssignmentEditor.createMany({
      data: toAdd.map((userId) => ({ assignmentId, userId, isActive: true })),
    });
  }
  return { added: toAdd.length, ended: toEnd.length };
}

export interface ReconcileOptions extends EditorChangeContext {
  reportId: string;
  /** Only these assignments (the scheduler passes the ones it has just made). */
  assignmentIds?: string[];
  /** Only periods that have not opened yet: what D09 lets the configuration change without a mid-period action. */
  onlyNotYetOpened?: boolean;
}

/**
 * Brings the assignments of a report's OPEN periods in line with the editors its configuration names now.
 *
 * Only people who qualify (`QUALIFIED_USER`) are ever put on an assignment. Left alone: an assignment whose team is no
 * longer in the configuration (its period keeps what it has), and a team none of whose configured editors qualifies
 * (stripping every editor would leave nobody able to type).
 */
export async function reconcileAssignmentEditors(
  tx: Tx,
  options: ReconcileOptions,
): Promise<EditorChangeResult> {
  const { reportId, now, assignmentIds, onlyNotYetOpened } = options;

  const targets = await tx.dynReportTarget.findMany({
    where: { reportId, ...inWindow(now) },
    include: {
      editors: {
        where: { ...inWindow(now), user: QUALIFIED_USER },
        select: { userId: true },
      },
    },
  });
  const wantedByTeam = new Map<string, Set<string>>();
  for (const target of targets) {
    const editors = new Set(target.editors.map((e) => e.userId));
    if (editors.size > 0) wantedByTeam.set(target.teamId, editors);
  }
  if (wantedByTeam.size === 0) return { added: 0, ended: 0 };

  const eligible = {
    teamId: { in: [...wantedByTeam.keys()] },
    period: {
      reportId,
      status: 'OPEN' as const,
      ...(onlyNotYetOpened ? { opensAt: { gt: now } } : {}),
    },
    ...(assignmentIds ? { id: { in: assignmentIds } } : {}),
  };
  const candidates = await tx.dynReportAssignment.findMany({
    where: eligible,
    select: { periodId: true },
    distinct: ['periodId'],
  });
  if (candidates.length === 0) return { added: 0, ended: 0 };

  // The mid-period action and every other write to a period take the period's row first. Reading the editors without
  // holding it would let two changes both end the same editor and each add its own replacement (two active rows). Lock
  // in id order so two reconciliations can never wait on each other, then look again: a period that closed, or an
  // assignment that was changed, while this waited is judged as it is now.
  const periodIds = [...new Set(candidates.map((c) => c.periodId))].sort();
  await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id IN (${Prisma.join(periodIds)}) ORDER BY id FOR UPDATE`;
  const assignments = await tx.dynReportAssignment.findMany({
    where: eligible,
    select: { id: true, teamId: true },
  });

  const total: EditorChangeResult = { added: 0, ended: 0 };
  for (const assignment of assignments) {
    const wanted = wantedByTeam.get(assignment.teamId);
    if (!wanted) continue;
    const result = await applyAssignmentEditors(
      tx,
      assignment.id,
      wanted,
      options,
    );
    total.added += result.added;
    total.ended += result.ended;
  }
  return total;
}

/**
 * The people who may be named as editors: they exist, are active, and their role can open the module (without
 * `read:DynamicReport` the menu entry and every list call would refuse them). Returns the ids that do NOT qualify.
 */
export async function findUnqualifiedEditors(
  tx: Tx,
  userIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  const ok = await tx.user.findMany({
    where: { id: { in: unique }, ...QUALIFIED_USER },
    select: { id: true },
  });
  const okIds = new Set(ok.map((u) => u.id));
  return unique.filter((id) => !okIds.has(id));
}

/**
 * The criteria the configuration gives a team right now, frozen into the field keys of one version; null when the team
 * reports everything (no subset configured, or the team is not in the configuration at all).
 */
export async function configuredSubsetOf(
  tx: Tx,
  reportId: string,
  versionId: string,
  teamId: string,
  now: Date,
): Promise<string[] | null> {
  const target = await tx.dynReportTarget.findFirst({
    where: { reportId, teamId, ...inWindow(now) },
    select: { itemKeys: true },
  });
  if (!Array.isArray(target?.itemKeys)) return null;
  const fields = await tx.dynReportField.findMany({
    where: { versionId },
    select: { fieldKey: true, itemKey: true },
    orderBy: [{ sheetKey: 'asc' }, { address: 'asc' }],
  });
  return freezeOwnedFieldKeys(target.itemKeys, fields);
}

/** The editors the configuration names for a team right now (active users only), or an empty set. */
export async function configuredEditorsOf(
  tx: Tx,
  reportId: string,
  teamId: string,
  now: Date,
): Promise<Set<string>> {
  const target = await tx.dynReportTarget.findFirst({
    where: { reportId, teamId, ...inWindow(now) },
    include: {
      editors: {
        where: { ...inWindow(now), user: QUALIFIED_USER },
        select: { userId: true },
      },
    },
  });
  return new Set((target?.editors ?? []).map((e) => e.userId));
}
