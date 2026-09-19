import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const editWindowRequestsMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'edit-window-requests',
    label: 'Yêu cầu reset thời hạn',
    path: '/admin/yeu-cau-reset',
    quyen: ['review_reset_request:EditWindowResetRequest'],
    icon: 'Clock',
  },
];
