import type { FeatureModule } from '@/lib/features/moduleTypes';
import { classificationManifest } from './feature.manifest';
import { renderClassificationRoutes } from './routes';
import { classificationMenu } from './menu';

const classificationFeature: FeatureModule = {
  manifest: classificationManifest,
  renderRoutes: renderClassificationRoutes,
  menu: classificationMenu,
};

export default classificationFeature;
