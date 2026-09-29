import { SetMetadata } from '@nestjs/common';

export interface PermissionRule {
  action: string;
  subject: string;
}

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'any_permissions';
export const RequirePermissions = (...permissions: PermissionRule[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require at least one permission from the supplied list.
 *
 * This is separate from `RequirePermissions`, whose established contract is
 * AND. Keeping two metadata keys avoids silently weakening existing routes.
 */
export const RequireAnyPermissions = (...permissions: PermissionRule[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
