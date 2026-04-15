import type { FeatureModule } from '@/lib/features/moduleTypes';
import { lawyersManifest } from './feature.manifest';
import { renderLawyersRoutes } from './routes';
import { lawyersMenu } from './menu';

const lawyersFeature: FeatureModule = {
  manifest: lawyersManifest,
  renderRoutes: renderLawyersRoutes,
  menu: lawyersMenu,
};

export default lawyersFeature;
