import { usePermission } from '@/hooks/usePermission';

/** The server permission keys of the two subjects, exactly as `@RequirePermissions` states them. */
export const PERMISSION = {
  flowRead: 'read:ProcessingFlow',
  flowCreate: 'create:ProcessingFlow',
  flowEdit: 'edit:ProcessingFlow',
  flowDelete: 'delete:ProcessingFlow',
  flowPublish: 'publish:ProcessingFlow',
  flowVerify: 'verify:ProcessingFlow',
  calendarRead: 'read:ProcessingCalendar',
  calendarEdit: 'edit:ProcessingCalendar',
  calendarConfirm: 'confirm:ProcessingCalendar',
} as const;

export interface ProcessingPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canVerify: boolean;
  canEditCalendar: boolean;
  canConfirmCalendar: boolean;
}

/**
 * What this account may do. The profile not being loaded yet (`permissions === null`) lets the control show for a
 * moment, as everywhere else: the server still refuses, and hiding then showing makes buttons flicker.
 */
export function useProcessingPermissions(): ProcessingPermissions {
  const { permissions } = usePermission();
  const has = (key: string): boolean => permissions === null || permissions.includes(key);
  return {
    canCreate: has(PERMISSION.flowCreate),
    canEdit: has(PERMISSION.flowEdit),
    canDelete: has(PERMISSION.flowDelete),
    canPublish: has(PERMISSION.flowPublish),
    canVerify: has(PERMISSION.flowVerify),
    canEditCalendar: has(PERMISSION.calendarEdit),
    canConfirmCalendar: has(PERMISSION.calendarConfirm),
  };
}
