import type { FeatureModule } from '@/lib/features/moduleTypes';
import { dashboardManifest } from './feature.manifest';
import { renderDashboardRoutes } from './routes';
import { dashboardMenu } from './menu';

const dashboardFeature: FeatureModule = {
  manifest: dashboardManifest,
  renderRoutes: renderDashboardRoutes,
  menu: dashboardMenu,
};

export default dashboardFeature;
