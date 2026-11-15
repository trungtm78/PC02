import type { FeatureModule } from '@/lib/features/moduleTypes';
import { processingFlowManifest } from './feature.manifest';
import { processingFlowMenu } from './menu';
import { renderProcessingFlowRoutes } from './routes';

const processingFlowFeature: FeatureModule = {
  manifest: processingFlowManifest,
  renderRoutes: renderProcessingFlowRoutes,
  menu: processingFlowMenu,
};

export default processingFlowFeature;
