import type { FeatureModule } from '@/lib/features/moduleTypes';
import { settingsManifest } from './feature.manifest';
import { renderSettingsRoutes } from './routes';
import { settingsMenu } from './menu';

const settingsFeature: FeatureModule = {
  manifest: settingsManifest,
  renderRoutes: renderSettingsRoutes,
  menu: settingsMenu,
};

export default settingsFeature;
