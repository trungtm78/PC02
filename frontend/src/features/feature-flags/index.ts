import type { FeatureModule } from '@/lib/features/moduleTypes';
import { featureFlagsManifest } from './feature.manifest';
import { renderFeatureFlagsRoutes } from './routes';
import { featureFlagsMenu } from './menu';

const featureFlagsFeature: FeatureModule = {
  manifest: featureFlagsManifest,
  renderRoutes: renderFeatureFlagsRoutes,
  menu: featureFlagsMenu,
};

export default featureFlagsFeature;
