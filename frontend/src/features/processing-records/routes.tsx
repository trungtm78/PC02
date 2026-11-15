import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { DELEGATION_PATH, TRACKING_PATH } from './menu';

const TrackingPage = lazy(() => import('@/features/processing-flow/tracking/TrackingPage'));
const DelegationPage = lazy(() => import('@/features/processing-flow/delegation/DelegationPage'));

export function renderProcessingRecordsRoutes(): ReactElement[] {
  return [
    <Route key="processing-tracking" path={TRACKING_PATH} element={wrapRoute(<TrackingPage />)} />,
    <Route key="processing-delegation" path={DELEGATION_PATH} element={wrapRoute(<DelegationPage />)} />,
  ];
}
