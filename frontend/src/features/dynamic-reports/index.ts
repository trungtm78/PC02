import type { FeatureModule } from '@/lib/features/moduleTypes';
import { dynamicReportsManifest } from './feature.manifest';
import { renderDynamicReportsRoutes } from './routes';
import { dynamicReportsMenu } from './menu';

const dynamicReportsFeature: FeatureModule = {
  manifest: dynamicReportsManifest,
  renderRoutes: renderDynamicReportsRoutes,
  menu: dynamicReportsMenu,
};

export default dynamicReportsFeature;
