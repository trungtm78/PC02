import type { FeatureModule } from '@/lib/features/moduleTypes';
import { kpiManifest } from './feature.manifest';
import { renderKpiRoutes } from './routes';
import { kpiMenu } from './menu';

const kpiFeature: FeatureModule = {
  manifest: kpiManifest,
  renderRoutes: renderKpiRoutes,
  menu: kpiMenu,
};

export default kpiFeature;
