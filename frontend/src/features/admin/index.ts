import type { FeatureModule } from '@/lib/features/moduleTypes';
import { adminManifest } from './feature.manifest';
import { renderAdminRoutes } from './routes';
import { adminMenu } from './menu';

const adminFeature: FeatureModule = {
  manifest: adminManifest,
  renderRoutes: renderAdminRoutes,
  menu: adminMenu,
};

export default adminFeature;
