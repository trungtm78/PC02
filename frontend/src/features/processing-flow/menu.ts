import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
import { processingFlow } from '@/locales/processingFlow.vi';

export const FLOWS_PATH = '/admin/quy-trinh';
export const CALENDAR_PATH = '/admin/lich-lam-viec';

export const processingFlowMenu: FeatureMenuEntry[] = [
  {
    section: 'admin',
    id: 'processing-flow',
    label: processingFlow.menu.flows,
    path: FLOWS_PATH,
    // GET /processing-flows is `read:ProcessingFlow`.
    quyen: ['read:ProcessingFlow'],
    icon: 'Workflow',
  },
  {
    section: 'admin',
    id: 'processing-calendar',
    label: processingFlow.menu.calendar,
    path: CALENDAR_PATH,
    // GET /processing-calendar/years is `read:ProcessingCalendar`.
    quyen: ['read:ProcessingCalendar'],
    icon: 'Calendar',
  },
];
