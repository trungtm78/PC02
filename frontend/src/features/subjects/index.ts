import type { FeatureModule } from '@/lib/features/moduleTypes';
import { subjectsManifest } from './feature.manifest';
import { renderSubjectsRoutes } from './routes';
import { subjectsMenu } from './menu';

const subjectsFeature: FeatureModule = {
  manifest: subjectsManifest,
  renderRoutes: renderSubjectsRoutes,
  menu: subjectsMenu,
};

export default subjectsFeature;
