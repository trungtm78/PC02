import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
import { processingFlow } from '@/locales/processingFlow.vi';

export const TRACKING_PATH = '/theo-doi-xu-ly';
export const BACKLOG_PATH = '/ton-dong-theo-don-vi';
export const DELEGATION_PATH = '/uy-quyen-xu-ly';

export const processingRecordsMenu: FeatureMenuEntry[] = [
  {
    section: 'workflow',
    id: 'processing-tracking',
    label: processingFlow.tracking.menu,
    path: TRACKING_PATH,
    // GET /processing/tracking/summary is `read:ProcessingStep`.
    quyen: ['read:ProcessingStep'],
    icon: 'Activity',
    // Above the other entries of the section: this is where a day's work starts.
    order: 10,
  },
  {
    section: 'workflow',
    id: 'processing-backlog',
    label: processingFlow.backlog.menu,
    path: BACKLOG_PATH,
    // GET /processing/backlog/units is `read:ProcessingStep`.
    quyen: ['read:ProcessingStep'],
    icon: 'Table2',
    // Right under "Theo dõi xử lý".
    order: 11,
  },
  {
    section: 'workflow',
    id: 'processing-delegation',
    label: processingFlow.delegation.menu,
    path: DELEGATION_PATH,
    // GET /processing/delegations is `read:ProcessingStep`.
    quyen: ['read:ProcessingStep'],
    icon: 'ArrowRightLeft',
    // After the two screens of the work itself.
    order: 12,
  },
];
