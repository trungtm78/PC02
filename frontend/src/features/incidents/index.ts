import type { FeatureModule } from '@/lib/features/moduleTypes';
import { incidentsManifest } from './feature.manifest';
import { renderIncidentsRoutes } from './routes';
import { incidentsMenu } from './menu';

const incidentsFeature: FeatureModule = {
  manifest: incidentsManifest,
  renderRoutes: renderIncidentsRoutes,
  menu: incidentsMenu,
};

export default incidentsFeature;
