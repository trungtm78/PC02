import { useCallback, useMemo } from 'react';
import { authStore } from '@/stores/auth.store';
import { ROLE_NAMES } from '@/shared/enums/roles';
import {
  type PermissionAction,
  type PermissionResource,
} from '@/shared/enums/permissions';
import {
  toPermissionSet,
  type BackendPermission,
} from '@/shared/enums/permission-mapping';

export type { PermissionAction, PermissionResource };

/**
 * Check what the signed-in user may actually do.
 *
 * This used to read MOCK_ALL_PERMISSIONS — a constant granting every action on
 * every resource to everybody. The backend PermissionsGuard was the only real
 * gate, so nothing was insecure; what users got was buttons they were not
 * allowed to press, and a 403 when they pressed one. The permissions now come
 * from `/auth/me`, cached in the auth store profile.
 *
 * Fail-closed on purpose: no profile yet means no permissions, not all of
 * them. A brief moment with a control hidden is correct; a brief moment with
 * a forbidden control shown is the bug this replaces.
 */
export function usePermission() {
  // One source, not two. `getUser()` already returns the cached profile when
  // there is one and falls back to the JWT payload otherwise — and the JWT
  // carries no permissions, so an unhydrated session yields an empty set.
  // That is the fail-closed behaviour we want, for free.
  const user = authStore.getUser();

  const permissionSet = useMemo(
    () =>
      toPermissionSet(
        (user as { permissions?: BackendPermission[] } | null)?.permissions,
      ),
    [user],
  );

  const hasPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      if (!user) return false;
      // ADMIN keeps the blanket pass: the backend seeds every permission to
      // ADMIN anyway, so denying here would only desynchronise the two.
      if (user.role?.toUpperCase() === ROLE_NAMES.ADMIN) return true;
      const permissions = permissionSet[resource as PermissionResource];
      if (!permissions) return false;
      return permissions.includes(action);
    },
    [user, permissionSet],
  );

  const canCreate = useCallback(
    (resource: string) => hasPermission(resource, 'create'),
    [hasPermission],
  );

  const canEdit = useCallback(
    (resource: string) => hasPermission(resource, 'edit'),
    [hasPermission],
  );

  const canDelete = useCallback(
    (resource: string) => hasPermission(resource, 'delete'),
    [hasPermission],
  );

  const canView = useCallback(
    (resource: string) => hasPermission(resource, 'view'),
    [hasPermission],
  );

  const canDispatch =
    user?.canDispatch === true || user?.role?.toUpperCase() === ROLE_NAMES.ADMIN;

  return {
    hasPermission,
    canCreate,
    canEdit,
    canDelete,
    canView,
    canDispatch,
    userRole: user?.role ?? null,
  };
}
