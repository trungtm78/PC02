import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { DungLaiTheoId } from '@/lib/features/dungLaiTheoId';

const WardAssignmentListPage = lazy(() => import('@/pages/ward-assignments/WardAssignmentListPage'));
const WardAssignmentFormPage = lazy(() => import('@/pages/ward-assignments/WardAssignmentFormPage'));
const WardAssignmentStatsPage = lazy(() => import('@/pages/ward-assignments/WardAssignmentStatsPage'));

/**
 * `/ho-so-phan-cong/:id` opens the request to read (fields read-only, an "Edit" button when the unit may change it);
 * `/ho-so-phan-cong/:id/edit` edits it. The `key` per mode keeps React from carrying the state of one into the other.
 */
export function renderWardAssignmentsRoutes(): ReactElement[] {
  return [
    <Route key="ward-assignments-list" path="/ho-so-phan-cong" element={wrapRoute(<WardAssignmentListPage />)} />,
    // Before `:id`, which would otherwise read "thong-ke" as the id of a request.
    <Route key="ward-assignments-stats" path="/ho-so-phan-cong/thong-ke" element={wrapRoute(<WardAssignmentStatsPage />)} />,
    <Route key="ward-assignments-new" path="/ho-so-phan-cong/new" element={wrapRoute(<DungLaiTheoId><WardAssignmentFormPage key="new" mode="edit" /></DungLaiTheoId>)} />,
    <Route key="ward-assignments-view" path="/ho-so-phan-cong/:id" element={wrapRoute(<DungLaiTheoId><WardAssignmentFormPage key="view" mode="view" /></DungLaiTheoId>)} />,
    <Route key="ward-assignments-edit" path="/ho-so-phan-cong/:id/edit" element={wrapRoute(<DungLaiTheoId><WardAssignmentFormPage key="edit" mode="edit" /></DungLaiTheoId>)} />,
  ];
}
