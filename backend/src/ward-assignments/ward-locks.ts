import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, WardAssignment } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, recordInScope, recordReadable, scopeConditions, teamInScope } from '../common/utils/scope-filter.util';
import { WARD_ERROR } from './ward-assignment.codes';
import { sameStamp, wardBody } from './ward-errors';

/**
 * How every command of a ward assignment request takes hold of it: the row locked for the rest of the transaction,
 * the form acted on compared with the stored one, then the reach. One place, used by the ward unit's commands and by
 * PC02's, so that the two never check differently.
 */

type Tx = Prisma.TransactionClient;
type Scope = DataScope | null | undefined;

/** The record helpers' view of a request: its team, and its owner (the person who entered it). */
export const reachOf = (row: Pick<WardAssignment, 'assignedTeamId' | 'enteredById'>) => ({ assignedTeamId: row.assignedTeamId, ownerId: row.enteredById });

/**
 * The shared desk at PC02 (`intake:WardAssignment`): ward officers enter their unit's requests on one account. Its
 * holder (never an administrator, who has no scope) enters a request for ANY ward unit, and reads only the requests
 * that account entered and that were NEVER submitted. "Never submitted" is "has no code": the code is given at the first
 * submission and kept for good, also when the round is withdrawn, so a request taken back by somebody else does not
 * come back to the desk. The marker wins over whatever else the person holds: a wider read grant from another unit
 * does not bring the submitted requests back.
 */
export const isIntake = (scope: Scope): boolean => scope?.precise?.wardIntake === true;

type ReadRow = Pick<WardAssignment, 'assignedTeamId' | 'enteredById' | 'code'>;

/**
 * Whether the person may READ the request. THE read rule of the module: every route, command, file, slip, match and
 * notification asks here or `wardReadConditions`, never the general helpers (gate: `ward-read-rule.gate.spec.ts`).
 */
export function wardReadable(row: ReadRow, scope: Scope): boolean {
  if (isIntake(scope)) return row.enteredById === scope!.precise!.userId && row.code === null;
  return recordReadable('WardAssignment', { assignedTeamId: row.assignedTeamId, enteredById: row.enteredById }, scope);
}

/** The same rule as conditions to OR: `null` = no restriction; `[]` = nothing at all. */
export function wardReadConditions(scope: Scope): Prisma.WardAssignmentWhereInput[] | null {
  if (isIntake(scope)) return [{ enteredById: scope!.precise!.userId, code: null }];
  return scopeConditions(scope, 'read', 'WardAssignment') as Prisma.WardAssignmentWhereInput[] | null;
}

/** Whether the person may enter a request (and name an investigator) for this ward unit. */
export const mayEnterFor = (teamId: string, scope: Scope): boolean => isIntake(scope) || teamInScope(teamId, scope, 'write', 'WardAssignment');

/** The row, locked; absent (404) for somebody who may not read it; 409 when the form acted on is not the stored one. */
export async function lockedRequest(tx: Tx, scope: Scope, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
  await tx.$queryRaw`SELECT id FROM "ward_assignments" WHERE id = ${id} FOR UPDATE`;
  const row = await tx.wardAssignment.findUnique({ where: { id } });
  if (!row || !wardReadable(row, scope)) {
    throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
  }
  if (!sameStamp(row.updatedAt, expectedUpdatedAt)) throw new ConflictException(wardBody(WARD_ERROR.CONFLICT, { updatedAt: row.updatedAt.toISOString() }));
  return row;
}

/** For the ward unit's commands: within the reach of changing, and not archived. */
export async function lockedForChange(tx: Tx, scope: Scope, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
  const row = await lockedRequest(tx, scope, id, expectedUpdatedAt);
  if (!recordInScope(reachOf(row), scope, 'write', 'WardAssignment')) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  if (row.archivedAt) throw new ConflictException(wardBody(WARD_ERROR.ARCHIVED));
  return row;
}

/** For PC02's commands: within the reach of reviewing. */
export async function lockedForReview(tx: Tx, scope: Scope, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
  const row = await lockedRequest(tx, scope, id, expectedUpdatedAt);
  if (!recordInActionScope(reachOf(row), scope, 'WardAssignment', 'review')) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  return row;
}

/**
 * For PC02's decisions on a request: the review reach, not archived, and never by a member of the request's own ward
 * unit (segregation of duties): somebody who sits in the ward and in PC02, an administrator too, does not decide the
 * ward's own request.
 */
export async function lockedForDecision(tx: Tx, scope: Scope, actorId: string, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
  const row = await lockedForReview(tx, scope, id, expectedUpdatedAt);
  if (row.archivedAt) throw new ConflictException(wardBody(WARD_ERROR.ARCHIVED));
  const member = await tx.userTeam.findFirst({ where: { userId: actorId, teamId: row.assignedTeamId }, select: { userId: true } });
  if (member) throw new ForbiddenException(wardBody(WARD_ERROR.REVIEW_OWN_UNIT_FORBIDDEN));
  return row;
}

/**
 * The ward unit's team, locked for share for the rest of the transaction: a merge or an archive of the team (which
 * lock it for update first) either waits for this transaction, or has already happened and is seen here. A request
 * or an investigator is never written into a team that was merged away or archived meanwhile.
 */
export async function lockedWardTeam(tx: Tx, teamId: string): Promise<{ id: string }> {
  const [team] = await tx.$queryRaw<{ id: string; wardId: string | null; status: string }[]>`
    SELECT id, "wardId", status FROM "teams" WHERE id = ${teamId} FOR SHARE`;
  if (!team || team.wardId === null || team.status !== 'ACTIVE') throw new BadRequestException(wardBody(WARD_ERROR.UNIT_NOT_WARD));
  return { id: team.id };
}
