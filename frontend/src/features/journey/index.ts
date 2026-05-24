import type { FeatureModule } from '@/lib/features/moduleTypes';
import { journeyManifest } from './feature.manifest';
import { renderJourneyRoutes } from './routes';
import { journeyMenu } from './menu';

const journeyFeature: FeatureModule = {
  manifest: journeyManifest,
  renderRoutes: renderJourneyRoutes,
  menu: journeyMenu,
};

export default journeyFeature;
