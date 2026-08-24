import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

// F1 swap (v0.56): IncidentListPageShell (PR2 ListPageShell) replaces legacy.
const IncidentListPage = lazy(() => import('@/pages/incidents/IncidentListPageShell'));
const IncidentFormPage = lazy(() => import('@/pages/incidents/IncidentFormPage'));
const IncidentDetailPage = lazy(() => import('@/pages/incidents/IncidentDetailPage'));


export function renderIncidentsRoutes(): ReactElement[] {
  return [
    <Route key="incidents-list" path="/vu-viec" element={wrapRoute(<IncidentListPage />)} />,
    <Route key="incidents-new" path="/vu-viec/new" element={wrapRoute(<IncidentFormPage />)} />,
    <Route key="incidents-detail" path="/vu-viec/:id" element={wrapRoute(<IncidentDetailPage />)} />,
    <Route key="incidents-edit" path="/vu-viec/:id/edit" element={wrapRoute(<IncidentFormPage />)} />,
    <Route key="incidents-alias" path="/incidents" element={wrapRoute(<IncidentListPage />)} />,
    // v0.67 fix: /incidents/new + /incidents/:id/edit aliases. Without these,
    // /incidents/new fell through to /incidents/:id (id="new") → IncidentDetailPage
    // GET /incidents/new → 404 → "Không thể tải thông tin vụ việc".
    <Route key="incidents-new-alias" path="/incidents/new" element={wrapRoute(<IncidentFormPage />)} />,
    <Route key="incidents-detail-alias" path="/incidents/:id" element={wrapRoute(<IncidentDetailPage />)} />,
    <Route key="incidents-edit-alias" path="/incidents/:id/edit" element={wrapRoute(<IncidentFormPage />)} />,
  ];
}
