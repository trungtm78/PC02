import type { FeatureModule } from '@/lib/features/moduleTypes';
import { processingRecordsManifest } from './feature.manifest';
import { processingRecordsMenu } from './menu';
import { renderProcessingRecordsRoutes } from './routes';

const processingRecordsFeature: FeatureModule = {
  manifest: processingRecordsManifest,
  renderRoutes: renderProcessingRecordsRoutes,
  menu: processingRecordsMenu,
};

export default processingRecordsFeature;
