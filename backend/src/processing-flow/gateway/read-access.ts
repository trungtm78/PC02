import type { PrismaService } from '../../prisma/prisma.service';
import { UnitScopeService, type DataScope } from '../../auth/services/unit-scope.service';
import { userHoldingPermission } from '../../authz/enforcement';
import type { GatewayUser } from './record-snapshot';

/**
 * The two things a detail route of a petition or an incident asks before the service looks at the record, asked the
 * way the request path asks them. Nothing is decided here: both answers come from the code the routes use.
 */

/**
 * The route guard's question (`@RequirePermissions({ action: 'read', subject })`): does this person, who must still be
 * active, hold the permission to read records of this subject at all. Answered by `userHoldingPermission`, the one
 * condition that says "a user who holds this permission" under permissions by team as well as from the role.
 */
export async function holdsReadPermission(
  prisma: PrismaService,
  userId: string,
  subject: 'Petition' | 'Incident',
): Promise<boolean> {
  const holders = await prisma.user.count({
    where: { AND: [{ id: userId, isActive: true }, userHoldingPermission('read', subject)] },
  });
  return holders > 0;
}

/** The scope the request would carry for this person (`DataScopeInterceptor`): `null` = unrestricted. */
export function requestScopeOf(scopes: UnitScopeService, user: GatewayUser): Promise<DataScope | null> {
  return scopes.resolveScope(user.id, user.role, user.canDispatch ?? false);
}
