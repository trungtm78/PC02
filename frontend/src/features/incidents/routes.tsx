import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const IncidentListPage = lazy(() => import('@/pages/incidents/IncidentListPage'));
const IncidentFormPage = lazy(() => import('@/pages/incidents/IncidentFormPage'));
const IncidentDetailPage = lazy(() => import('@/pages/incidents/IncidentDetailPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderIncidentsRoutes(): ReactElement[] {
  return [
    <Route key="incidents-list" path="/vu-viec" element={wrap(<IncidentListPage />)} />,
    <Route key="incidents-new" path="/vu-viec/new" element={wrap(<IncidentFormPage />)} />,
    <Route key="incidents-detail" path="/vu-viec/:id" element={wrap(<IncidentDetailPage />)} />,
    <Route key="incidents-edit" path="/vu-viec/:id/edit" element={wrap(<IncidentFormPage />)} />,
    <Route key="incidents-alias" path="/incidents" element={wrap(<IncidentListPage />)} />,
    <Route key="incidents-detail-alias" path="/incidents/:id" element={wrap(<IncidentDetailPage />)} />,
  ];
}
