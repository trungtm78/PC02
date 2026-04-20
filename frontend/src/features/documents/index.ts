import type { FeatureModule } from '@/lib/features/moduleTypes';
import { documentsManifest } from './feature.manifest';
import { renderDocumentsRoutes } from './routes';
import { documentsMenu } from './menu';

const documentsFeature: FeatureModule = {
  manifest: documentsManifest,
  renderRoutes: renderDocumentsRoutes,
  menu: documentsMenu,
};

export default documentsFeature;
