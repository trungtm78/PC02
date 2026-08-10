import { useCallback, useMemo, useSyncExternalStore } from 'react';
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
/** Stable subscriber so useSyncExternalStore does not resubscribe each render. */
const subscribeToAuth = (onChange: () => void) =>
  authStore.onTokenChanged(onChange);

export function usePermission() {
  // Subscribed, not snapshotted. Reading the store once meant a component
  // mounted before `/auth/me` resolved kept the JWT fallback's empty set —
  // permanently, until something unrelated re-rendered it. The controls stayed
  // hidden for the whole session. `setProfile` emits AUTH_TOKEN_EVENT, so
  // useSyncExternalStore re-reads on hydration and on any later change.
  //
  // One source, not two: `getUser()` returns the cached profile when there is
  // one and falls back to the JWT otherwise — and the JWT carries no
  // permissions, so an unhydrated session yields an empty set. Fail-closed for
  // free.
  const rawProfile = useSyncExternalStore(
    subscribeToAuth,
    () => authStore.getProfileRaw(),
    () => null,
  );
  const user = useMemo(() => {
    // Parse the snapshot we subscribed to, rather than calling getUser() and
    // listing rawProfile as a dependency it never reads — that reads as a lie
    // to anyone maintaining this, and to the exhaustive-deps rule.
    if (rawProfile) {
      try {
        return JSON.parse(rawProfile) as ReturnType<typeof authStore.getUser>;
      } catch {
        return null;
      }
    }
    // No cached profile: fall back to the JWT, which carries no permissions.
    return authStore.getUser();
  }, [rawProfile]);

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
      // No ADMIN shortcut. PermissionsGuard deliberately has none either — it
      // reads live rolePermission rows, so an admin whose role lost a
      // permission in the role editor is denied by the API. A frontend
      // shortcut would have shown them the button anyway. The seed grants
      // ADMIN every permission, so in practice nothing changes; what changes
      // is that the two sides now agree.
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
