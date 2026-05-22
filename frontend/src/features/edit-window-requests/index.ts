import type { FeatureModule } from '@/lib/features/moduleTypes';
import { editWindowRequestsManifest } from './feature.manifest';
import { renderEditWindowRequestsRoutes } from './routes';
import { editWindowRequestsMenu } from './menu';

const editWindowRequestsFeature: FeatureModule = {
  manifest: editWindowRequestsManifest,
  renderRoutes: renderEditWindowRequestsRoutes,
  menu: editWindowRequestsMenu,
};

export default editWindowRequestsFeature;
