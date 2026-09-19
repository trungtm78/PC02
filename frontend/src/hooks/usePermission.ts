import { useCallback, useEffect, useReducer } from 'react';
import { authStore } from '@/stores/auth.store';
import { TEN_SU_KIEN_DOI_TOKEN } from '@/stores/auth-su-kien';
import { ROLE_NAMES } from '@/shared/enums/roles';
import {
  khoaQuyenMayChu,
  type PermissionAction,
  type PermissionResource,
} from '@/shared/enums/permissions';

export type { PermissionAction, PermissionResource };

/**
 * Ẩn/hiện nút theo QUYỀN THẬT của vai trò — `permissions` trong hồ sơ /auth/me, cùng nguồn với PermissionsGuard của
 * máy chủ (không ưu tiên riêng ADMIN: quản trị có đủ quyền qua role_permissions). Tài nguyên lạ → không.
 *
 * Hồ sơ chưa nạp (chỉ có JWT, vài trăm ms đầu) → TẠM cho hiện: máy chủ vẫn chặn, còn ẩn rồi hiện lại làm nút chớp
 * tắt. Nạp xong là theo đúng quyền.
 */
export function usePermission() {
  // Vẽ lại khi token/hồ sơ đổi — màn vẽ trước khi /auth/me về vẫn chuyển sang đúng quyền ngay khi hồ sơ nạp xong.
  const [, veLai] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(TEN_SU_KIEN_DOI_TOKEN, veLai);
    return () => window.removeEventListener(TEN_SU_KIEN_DOI_TOKEN, veLai);
  }, []);
  const user = authStore.getUser();
  const permissions =
    user && 'permissions' in user && Array.isArray(user.permissions) ? user.permissions : null;

  const hasPermission = useCallback(
    (resource: string, action: PermissionAction): boolean => {
      if (!user) return false;
      const khoa = khoaQuyenMayChu(resource, action);
      if (!khoa) return false;
      if (!permissions) return true;
      return permissions.includes(khoa);
    },
    [user, permissions],
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
