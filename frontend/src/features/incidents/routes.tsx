import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// F1 swap (v0.56): IncidentListPageShell (PR2 ListPageShell) replaces legacy.
const IncidentListPage = lazy(() => import('@/pages/incidents/IncidentListPageShell'));
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
    // v0.67 fix: /incidents/new + /incidents/:id/edit aliases. Without these,
    // /incidents/new fell through to /incidents/:id (id="new") → IncidentDetailPage
    // GET /incidents/new → 404 → "Không thể tải thông tin vụ việc".
    <Route key="incidents-new-alias" path="/incidents/new" element={wrap(<IncidentFormPage />)} />,
    <Route key="incidents-detail-alias" path="/incidents/:id" element={wrap(<IncidentDetailPage />)} />,
    <Route key="incidents-edit-alias" path="/incidents/:id/edit" element={wrap(<IncidentFormPage />)} />,
  ];
}
