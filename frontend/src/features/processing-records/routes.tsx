import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { TRACKING_PATH } from './menu';

const TrackingPage = lazy(() => import('@/features/processing-flow/tracking/TrackingPage'));

export function renderProcessingRecordsRoutes(): ReactElement[] {
  return [<Route key="processing-tracking" path={TRACKING_PATH} element={wrapRoute(<TrackingPage />)} />];
}
