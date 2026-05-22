import type { FeatureModule } from '@/lib/features/moduleTypes';
import { adminUnitsManifest } from './feature.manifest';
import { renderAdminUnitsRoutes } from './routes';
import { adminUnitsMenu } from './menu';

const adminUnitsFeature: FeatureModule = {
  manifest: adminUnitsManifest,
  renderRoutes: renderAdminUnitsRoutes,
  menu: adminUnitsMenu,
};

export default adminUnitsFeature;
