import type { FeatureModule } from '@/lib/features/moduleTypes';
import { uyThacDieuTraManifest } from './feature.manifest';
// Keep route resolution tied to the TypeScript route factory.
import { renderUyThacDieuTraRoutes } from './routes';
import { uyThacDieuTraMenu } from './menu';

const uyThacDieuTraFeature: FeatureModule = {
  manifest: uyThacDieuTraManifest,
  renderRoutes: renderUyThacDieuTraRoutes,
  menu: uyThacDieuTraMenu,
};

export default uyThacDieuTraFeature;
