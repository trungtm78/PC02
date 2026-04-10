import { SetMetadata } from '@nestjs/common';

export interface PermissionRule {
  action: string;
  subject: string;
}

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: PermissionRule[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
