import type { Prisma } from '@prisma/client';

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
 * Left alone: an assignment whose team is no longer in the configuration (its period keeps what it has), and a team
 * whose configured editors are all inactive (stripping every editor would leave nobody able to type).
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
        where: { ...inWindow(now), user: { isActive: true } },
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

  const assignments = await tx.dynReportAssignment.findMany({
    where: {
      teamId: { in: [...wantedByTeam.keys()] },
      period: {
        reportId,
        status: 'OPEN',
        ...(onlyNotYetOpened ? { opensAt: { gt: now } } : {}),
      },
      ...(assignmentIds ? { id: { in: assignmentIds } } : {}),
    },
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
    where: {
      id: { in: unique },
      isActive: true,
      role: {
        permissions: {
          some: { permission: { action: 'read', subject: 'DynamicReport' } },
        },
      },
    },
    select: { id: true },
  });
  const okIds = new Set(ok.map((u) => u.id));
  return unique.filter((id) => !okIds.has(id));
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
        where: { ...inWindow(now), user: { isActive: true } },
        select: { userId: true },
      },
    },
  });
  return new Set((target?.editors ?? []).map((e) => e.userId));
}
