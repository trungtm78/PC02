import type { FeatureModule } from '@/lib/features/moduleTypes';
import { directoryManifest } from './feature.manifest';
import { renderDirectoryRoutes } from './routes';
import { directoryMenu } from './menu';

const directoryFeature: FeatureModule = {
  manifest: directoryManifest,
  renderRoutes: renderDirectoryRoutes,
  menu: directoryMenu,
};

export default directoryFeature;
