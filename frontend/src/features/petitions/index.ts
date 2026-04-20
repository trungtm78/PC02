import type { FeatureModule } from '@/lib/features/moduleTypes';
import { petitionsManifest } from './feature.manifest';
import { renderPetitionsRoutes } from './routes';
import { petitionsMenu } from './menu';

const petitionsFeature: FeatureModule = {
  manifest: petitionsManifest,
  renderRoutes: renderPetitionsRoutes,
  menu: petitionsMenu,
};

export default petitionsFeature;
