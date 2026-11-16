import type { FeatureModule } from '@/lib/features/moduleTypes';
import { wardAssignmentsManifest } from './feature.manifest';
import { renderWardAssignmentsRoutes } from './routes';
import { wardAssignmentsMenu } from './menu';

const wardAssignmentsFeature: FeatureModule = {
  manifest: wardAssignmentsManifest,
  renderRoutes: renderWardAssignmentsRoutes,
  menu: wardAssignmentsMenu,
};

export default wardAssignmentsFeature;
