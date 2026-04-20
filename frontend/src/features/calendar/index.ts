import type { FeatureModule } from '@/lib/features/moduleTypes';
import { calendarManifest } from './feature.manifest';
import { renderCalendarRoutes } from './routes';
import { calendarMenu } from './menu';

const calendarFeature: FeatureModule = {
  manifest: calendarManifest,
  renderRoutes: renderCalendarRoutes,
  menu: calendarMenu,
};

export default calendarFeature;
