import type { FeatureModule } from '@/lib/features/moduleTypes';
import { comprehensiveManifest } from './feature.manifest';
import { renderComprehensiveRoutes } from './routes';
import { comprehensiveMenu } from './menu';

const comprehensiveFeature: FeatureModule = {
  manifest: comprehensiveManifest,
  renderRoutes: renderComprehensiveRoutes,
  menu: comprehensiveMenu,
};

export default comprehensiveFeature;
