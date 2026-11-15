import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';
import { processingFlow } from '@/locales/processingFlow.vi';

/** The key is the backend switch (`feature_flags.key`): off in production until the owner turns it on. */
export const processingFlowManifest: FeatureModuleManifest = {
  key: 'processing_flow',
  label: processingFlow.menu.flows,
  description: processingFlow.menu.description,
  domain: 'admin-domain',
  icon: 'Workflow',
};
