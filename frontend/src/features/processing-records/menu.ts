import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';
import { processingFlow } from '@/locales/processingFlow.vi';

export const TRACKING_PATH = '/theo-doi-xu-ly';

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
];
