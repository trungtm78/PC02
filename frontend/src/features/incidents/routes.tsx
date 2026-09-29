import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { DungLaiTheoId } from '@/lib/features/dungLaiTheoId';

// F1 swap (v0.56): IncidentListPageShell (PR2 ListPageShell) replaces legacy.
const IncidentListPage = lazy(() => import('@/pages/incidents/IncidentListPageShell'));
const IncidentFormPage = lazy(() => import('@/pages/incidents/IncidentFormPage'));


export function renderIncidentsRoutes(): ReactElement[] {
  return [
    <Route key="incidents-list" path="/vu-viec" element={wrapRoute(<IncidentListPage />)} />,
    <Route key="incidents-new" path="/vu-viec/new" element={wrapRoute(<DungLaiTheoId><IncidentFormPage /></DungLaiTheoId>)} />,
    <Route key="incidents-detail" path="/vu-viec/:id" element={wrapRoute(<DungLaiTheoId><IncidentFormPage readOnly /></DungLaiTheoId>)} />,
    <Route key="incidents-edit" path="/vu-viec/:id/edit" element={wrapRoute(<DungLaiTheoId><IncidentFormPage /></DungLaiTheoId>)} />,
    <Route key="incidents-alias" path="/incidents" element={wrapRoute(<IncidentListPage />)} />,
    // v0.67 fix: /incidents/new + /incidents/:id/edit aliases. Without these,
    // /incidents/new must stay before /incidents/:id so "new" is never treated as a record id.
    // GET /incidents/new → 404 → "Không thể tải thông tin vụ việc".
    <Route key="incidents-new-alias" path="/incidents/new" element={wrapRoute(<DungLaiTheoId><IncidentFormPage /></DungLaiTheoId>)} />,
    <Route key="incidents-detail-alias" path="/incidents/:id" element={wrapRoute(<DungLaiTheoId><IncidentFormPage readOnly /></DungLaiTheoId>)} />,
    <Route key="incidents-edit-alias" path="/incidents/:id/edit" element={wrapRoute(<DungLaiTheoId><IncidentFormPage /></DungLaiTheoId>)} />,
  ];
}
