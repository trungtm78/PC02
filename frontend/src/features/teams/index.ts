import type { FeatureModule } from '@/lib/features/moduleTypes';
import { teamsManifest } from './feature.manifest';
import { renderTeamsRoutes } from './routes';
import { teamsMenu } from './menu';

const teamsFeature: FeatureModule = {
  manifest: teamsManifest,
  renderRoutes: renderTeamsRoutes,
  menu: teamsMenu,
};

export default teamsFeature;
