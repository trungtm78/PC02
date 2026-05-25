import type { FeatureModule } from '@/lib/features/moduleTypes';
import { documentNumbersManifest } from './feature.manifest';
import { renderDocumentNumbersRoutes } from './routes';
import { documentNumbersMenu } from './menu';

const documentNumbersFeature: FeatureModule = {
  manifest: documentNumbersManifest,
  renderRoutes: renderDocumentNumbersRoutes,
  menu: documentNumbersMenu,
};

export default documentNumbersFeature;
