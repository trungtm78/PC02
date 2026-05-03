import { useCallback } from 'react';
import { authStore } from '@/stores/auth.store';
import { ROLE_NAMES } from '@/shared/enums/roles';
import {
  MOCK_ALL_PERMISSIONS,
  type PermissionAction,
  type PermissionResource,
} from '@/shared/enums/permissions';

export type { PermissionAction, PermissionResource };

/**
 * Hook to check user permissions.
 * Returns helpers for checking create/edit/delete/view access by resource name.
 * All users currently get full access (mock mode); replace with CASL API fetch later.
 */
export function usePermission() {
  const user = authStore.getUser();

  const hasPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      if (!user) return false;
      if (user.role?.toUpperCase() === ROLE_NAMES.ADMIN) return true;
      const permissions = MOCK_ALL_PERMISSIONS[resource as PermissionResource];
      if (!permissions) return false;
      return permissions.includes(action);
    },
    [user],
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
