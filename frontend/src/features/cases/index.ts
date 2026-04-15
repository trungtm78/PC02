import type { FeatureModule } from '@/lib/features/moduleTypes';
import { casesManifest } from './feature.manifest';
import { renderCasesRoutes } from './routes';
import { casesMenu } from './menu';

const casesFeature: FeatureModule = {
  manifest: casesManifest,
  renderRoutes: renderCasesRoutes,
  menu: casesMenu,
};

export default casesFeature;
