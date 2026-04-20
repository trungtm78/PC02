import type { FeatureModule } from '@/lib/features/moduleTypes';
import { masterClassManifest } from './feature.manifest';
import { renderMasterClassRoutes } from './routes';
import { masterClassMenu } from './menu';

const masterClassFeature: FeatureModule = {
  manifest: masterClassManifest,
  renderRoutes: renderMasterClassRoutes,
  menu: masterClassMenu,
};

export default masterClassFeature;
