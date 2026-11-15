import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { BACKLOG_PATH, TRACKING_PATH } from './menu';

const TrackingPage = lazy(() => import('@/features/processing-flow/tracking/TrackingPage'));
const BacklogPage = lazy(() => import('@/features/processing-flow/backlog/BacklogPage'));

export function renderProcessingRecordsRoutes(): ReactElement[] {
  return [
    <Route key="processing-tracking" path={TRACKING_PATH} element={wrapRoute(<TrackingPage />)} />,
    <Route key="processing-backlog" path={BACKLOG_PATH} element={wrapRoute(<BacklogPage />)} />,
  ];
}
