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
  stepRead: 'read:ProcessingStep',
  stepAssign: 'assign:ProcessingStep',
  stepComplete: 'complete:ProcessingStep',
  stepReopen: 'reopen:ProcessingStep',
  stepSkip: 'skip:ProcessingStep',
  stepAdjustDue: 'adjustDue:ProcessingStep',
  stepExtend: 'extend:ProcessingStep',
  stepReport: 'report:ProcessingStep',
  stepOpine: 'opine:ProcessingStep',
  stepApprove: 'approve:ProcessingStep',
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

/** What this account may do on the steps of a record (the subject `ProcessingStep`). */
export interface StepPermissions {
  canRead: boolean;
  canAssign: boolean;
  canComplete: boolean;
  canReopen: boolean;
  canSkip: boolean;
  canAdjustDue: boolean;
  canExtend: boolean;
  canReport: boolean;
  canOpine: boolean;
  canApprove: boolean;
}

/** Same rule as `useProcessingPermissions`: a profile not loaded yet lets a control show; the server still refuses. */
export function useStepPermissions(): StepPermissions {
  const { permissions } = usePermission();
  const has = (key: string): boolean => permissions === null || permissions.includes(key);
  return {
    canRead: has(PERMISSION.stepRead),
    canAssign: has(PERMISSION.stepAssign),
    canComplete: has(PERMISSION.stepComplete),
    canReopen: has(PERMISSION.stepReopen),
    canSkip: has(PERMISSION.stepSkip),
    canAdjustDue: has(PERMISSION.stepAdjustDue),
    canExtend: has(PERMISSION.stepExtend),
    canReport: has(PERMISSION.stepReport),
    canOpine: has(PERMISSION.stepOpine),
    canApprove: has(PERMISSION.stepApprove),
  };
}
