import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const UserManagementPage = lazy(() => import('@/pages/users/UserManagementPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const DeadlineRulesListPage = lazy(() => import('@/pages/admin/deadline-rules/DeadlineRulesListPage'));
const ProposeDeadlineRulePage = lazy(() => import('@/pages/admin/deadline-rules/ProposeDeadlineRulePage'));
const VersionDecisionPage = lazy(() => import('@/pages/admin/deadline-rules/VersionDecisionPage'));
const ApprovalQueuePage = lazy(() => import('@/pages/admin/deadline-rules/ApprovalQueuePage'));
const DeadlineRuleHistoryPage = lazy(() => import('@/pages/admin/deadline-rules/DeadlineRuleHistoryPage'));
const MigrationCleanupPage = lazy(() => import('@/pages/admin/deadline-rules/MigrationCleanupPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderAdminRoutes(): ReactElement[] {
  return [
    <Route key="users" path="/nguoi-dung" element={wrap(<UserManagementPage />)} />,
    <Route key="admin-settings" path="/admin/settings" element={wrap(<AdminSettingsPage />)} />,
    // Deadline Rule Versioning workflow
    <Route key="deadline-rules-list" path="/admin/deadline-rules" element={wrap(<DeadlineRulesListPage />)} />,
    <Route
      key="deadline-rules-queue"
      path="/admin/deadline-rules/approval-queue"
      element={wrap(<ApprovalQueuePage />)}
    />,
    <Route
      key="deadline-rules-cleanup"
      path="/admin/deadline-rules/migration-cleanup"
      element={wrap(<MigrationCleanupPage />)}
    />,
    <Route
      key="deadline-rules-history"
      path="/admin/deadline-rules/:key/history"
      element={wrap(<DeadlineRuleHistoryPage />)}
    />,
    <Route
      key="deadline-rules-propose"
      path="/admin/deadline-rules/:key/propose"
      element={wrap(<ProposeDeadlineRulePage />)}
    />,
    <Route
      key="deadline-rules-edit"
      path="/admin/deadline-rules/edit/:id"
      element={wrap(<ProposeDeadlineRulePage />)}
    />,
    <Route
      key="deadline-rules-version"
      path="/admin/deadline-rules/version/:id"
      element={wrap(<VersionDecisionPage />)}
    />,
  ];
}
