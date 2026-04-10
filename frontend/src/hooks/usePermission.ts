import { useCallback } from 'react';
import { authStore } from '@/stores/auth.store';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface PermissionResource {
  name: string;
  actions: PermissionAction[];
}

/**
 * Mock permissions data - in production this would come from API/user token
 */
const MOCK_PERMISSIONS: Record<string, PermissionAction[]> = {
  cases: ['view', 'create', 'edit', 'delete'],
  petitions: ['view', 'create', 'edit', 'delete'],
  incidents: ['view', 'create', 'edit', 'delete'],
  objects: ['view', 'create', 'edit', 'delete'],
  users: ['view', 'create', 'edit', 'delete'],
  settings: ['view', 'create', 'edit', 'delete'],
  lawyers: ['view', 'create', 'edit', 'delete'],
  directories: ['view', 'create', 'edit', 'delete'],
  reports: ['view', 'create'],
  calendar: ['view', 'create', 'edit', 'delete'],
};

/**
 * Hook to check user permissions
 * @returns Functions to check if user has specific permissions
 */
export function usePermission() {
  const user = authStore.getUser();

  /**
   * Check if user has permission for a specific action on a resource
   * @param resource - Resource name (e.g., 'cases', 'users')
   * @param action - Action to check (e.g., 'create', 'edit')
   * @returns boolean
   */
  const hasPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      // No user = no permissions
      if (!user) return false;
      
      // Admin role has all permissions
      if (user.role === 'admin') return true;
      
      // Check specific permission
      const permissions = MOCK_PERMISSIONS[resource];
      if (!permissions) return false;
      
      return permissions.includes(action);
    },
    [user]
  );

  /**
   * Check if user can create a resource
   * @param resource - Resource name
   * @returns boolean
   */
  const canCreate = useCallback(
    (resource: string): boolean => {
      return hasPermission(resource, 'create');
    },
    [hasPermission]
  );

  /**
   * Check if user can edit a resource
   * @param resource - Resource name
   * @returns boolean
   */
  const canEdit = useCallback(
    (resource: string): boolean => {
      return hasPermission(resource, 'edit');
    },
    [hasPermission]
  );

  /**
   * Check if user can delete a resource
   * @param resource - Resource name
   * @returns boolean
   */
  const canDelete = useCallback(
    (resource: string): boolean => {
      return hasPermission(resource, 'delete');
    },
    [hasPermission]
  );

  /**
   * Check if user can view a resource
   * @param resource - Resource name
   * @returns boolean
   */
  const canView = useCallback(
    (resource: string): boolean => {
      return hasPermission(resource, 'view');
    },
    [hasPermission]
  );

  return {
    hasPermission,
    canCreate,
    canEdit,
    canDelete,
    canView,
    userRole: user?.role || null,
  };
}
