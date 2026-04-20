import type { FeatureModule } from '@/lib/features/moduleTypes';
import { workflowManifest } from './feature.manifest';
import { renderWorkflowRoutes } from './routes';
import { workflowMenu } from './menu';

const workflowFeature: FeatureModule = {
  manifest: workflowManifest,
  renderRoutes: renderWorkflowRoutes,
  menu: workflowMenu,
};

export default workflowFeature;
