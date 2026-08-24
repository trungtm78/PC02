import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const UserManagementPage = lazy(() => import('@/pages/users/UserManagementPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const RestorePage = lazy(() => import('@/pages/admin/RestorePage')); // v0.32.0.0
const DeadlineRulesListPage = lazy(() => import('@/pages/admin/deadline-rules/DeadlineRulesListPage'));
const ProposeDeadlineRulePage = lazy(() => import('@/pages/admin/deadline-rules/ProposeDeadlineRulePage'));
const VersionDecisionPage = lazy(() => import('@/pages/admin/deadline-rules/VersionDecisionPage'));
const ApprovalQueuePage = lazy(() => import('@/pages/admin/deadline-rules/ApprovalQueuePage'));
const DeadlineRuleHistoryPage = lazy(() => import('@/pages/admin/deadline-rules/DeadlineRuleHistoryPage'));
const MigrationCleanupPage = lazy(() => import('@/pages/admin/deadline-rules/MigrationCleanupPage'));
const LegacyMigrationPage = lazy(() => import('@/pages/admin/LegacyMigrationPage'));


export function renderAdminRoutes(): ReactElement[] {
  return [
    <Route key="users" path="/nguoi-dung" element={wrapRoute(<UserManagementPage />)} />,
    <Route key="legacy-migration" path="/admin/di-tru-du-lieu" element={wrapRoute(<LegacyMigrationPage />)} />,
    <Route key="admin-settings" path="/admin/settings" element={wrapRoute(<AdminSettingsPage />)} />,
    <Route key="admin-restore" path="/admin/khoi-phuc" element={wrapRoute(<RestorePage />)} />,
    // Deadline Rule Versioning workflow
    <Route key="deadline-rules-list" path="/admin/deadline-rules" element={wrapRoute(<DeadlineRulesListPage />)} />,
    <Route
      key="deadline-rules-queue"
      path="/admin/deadline-rules/approval-queue"
      element={wrapRoute(<ApprovalQueuePage />)}
    />,
    <Route
      key="deadline-rules-cleanup"
      path="/admin/deadline-rules/migration-cleanup"
      element={wrapRoute(<MigrationCleanupPage />)}
    />,
    <Route
      key="deadline-rules-history"
      path="/admin/deadline-rules/:key/history"
      element={wrapRoute(<DeadlineRuleHistoryPage />)}
    />,
    <Route
      key="deadline-rules-propose"
      path="/admin/deadline-rules/:key/propose"
      element={wrapRoute(<ProposeDeadlineRulePage />)}
    />,
    <Route
      key="deadline-rules-edit"
      path="/admin/deadline-rules/edit/:id"
      element={wrapRoute(<ProposeDeadlineRulePage />)}
    />,
    <Route
      key="deadline-rules-version"
      path="/admin/deadline-rules/version/:id"
      element={wrapRoute(<VersionDecisionPage />)}
    />,
  ];
}
