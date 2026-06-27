import type { FeatureModule } from '@/lib/features/moduleTypes';
import { documentTemplatesManifest } from './feature.manifest';
import { renderDocumentTemplatesRoutes } from './routes';
import { documentTemplatesMenu } from './menu';

const documentTemplatesFeature: FeatureModule = {
  manifest: documentTemplatesManifest,
  renderRoutes: renderDocumentTemplatesRoutes,
  menu: documentTemplatesMenu,
};

export default documentTemplatesFeature;
