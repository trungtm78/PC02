import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, WardAssignment } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { recordInActionScope, recordReadable } from '../common/utils/scope-filter.util';
import { WARD_ERROR } from './ward-assignment.codes';
import { wardBody } from './ward-errors';
import { reachOf } from './ward-locks';

type Tx = Prisma.TransactionClient;
type Scope = DataScope | null | undefined;

/** Whether the person may read the request (the read reach of `WardAssignment`). */
export const readableRequest = (row: Pick<WardAssignment, 'assignedTeamId' | 'enteredById'>, scope: Scope): boolean =>
  recordReadable('WardAssignment', { assignedTeamId: row.assignedTeamId, enteredById: row.enteredById }, scope);

/** The request for reading its files: absent (404) for somebody who may not read it. */
export async function requestForRead(tx: Tx, scope: Scope, id: string): Promise<WardAssignment> {
  const row = await tx.wardAssignment.findUnique({ where: { id } });
  if (!row || !readableRequest(row, scope)) throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
  return row;
}

/**
 * The request for writing its files or its request slips (PC02's block 3): locked FOR SHARE for the rest of the
 * transaction (a decision being cancelled or an archive, which lock it FOR UPDATE, waits for this write or is seen by
 * it; two uploads do not wait for each other); absent (404) for somebody who may not read it; refused (403) outside
 * the review reach or to a member of the request's own ward unit (segregation of duties, as for the decisions);
 * refused (409) while archived. The files carry no stamp of the request: adding one does not change the request.
 */
export async function requestForDocsWrite(tx: Tx, scope: Scope, actorId: string, id: string): Promise<WardAssignment> {
  await tx.$queryRaw`SELECT id FROM "ward_assignments" WHERE id = ${id} FOR SHARE`;
  const row = await requestForRead(tx, scope, id);
  if (!recordInActionScope(reachOf(row), scope, 'WardAssignment', 'review')) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  const member = await tx.userTeam.findFirst({ where: { userId: actorId, teamId: row.assignedTeamId }, select: { userId: true } });
  if (member) throw new ForbiddenException(wardBody(WARD_ERROR.REVIEW_OWN_UNIT_FORBIDDEN));
  if (row.archivedAt) throw new ConflictException(wardBody(WARD_ERROR.ARCHIVED));
  return row;
}
