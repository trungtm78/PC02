import type { FeatureModule } from '@/lib/features/moduleTypes';
import { reportsManifest } from './feature.manifest';
import { renderReportsRoutes } from './routes';
import { reportsMenu } from './menu';

const reportsFeature: FeatureModule = {
  manifest: reportsManifest,
  renderRoutes: renderReportsRoutes,
  menu: reportsMenu,
};

export default reportsFeature;
