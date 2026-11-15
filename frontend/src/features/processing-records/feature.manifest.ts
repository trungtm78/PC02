import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';
import { processingFlow } from '@/locales/processingFlow.vi';
import { RECORDS_FEATURE_KEY } from '@/features/processing-flow/record-tabs/tabAvailability';

/**
 * The screens that exist only while a record carries the steps of a flow. The key is the backend switch
 * `processing_flow_records` (a different switch from `processing_flow`, which opens the settings screens): the sidebar
 * hides this module's entries while that switch is off.
 */
export const processingRecordsManifest: FeatureModuleManifest = {
  key: RECORDS_FEATURE_KEY,
  label: processingFlow.menu.records,
  description: processingFlow.menu.recordsDescription,
  domain: 'workflow-domain',
  icon: 'Activity',
};
