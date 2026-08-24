import { lazy, type ReactElement } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

// F1 swap (v0.56): CaseListPageShell (PR1 ListPageShell) replaces legacy CaseListPage.
// Legacy CaseListPage.tsx kept on disk for ref; delete after 2+ release soak.
const CaseListPage = lazy(() => import('@/pages/cases/CaseListPageShell'));
const CaseFormPage = lazy(() => import('@/pages/cases/CaseFormPage'));
const CaseDetailPage = lazy(() => import('@/pages/cases/CaseDetailPage'));
// v0.37.1: ComprehensiveListPage + InitialCasesPage routes moved to features/comprehensive/routes.tsx
const CaseTdcBackfillPage = lazy(() => import('@/pages/cases/CaseTdcBackfillPage'));
const CaseJourneyStandalonePage = lazy(() => import('@/pages/cases/CaseJourneyStandalonePage'));


export function renderCasesRoutes(): ReactElement[] {
  return [
    <Route
      key="cases-list"
      path="/cases"
      element={wrapRoute(<CaseListPage />)}
    />,
    <Route
      key="cases-journey-standalone"
      path="/cases/:id/journey"
      element={wrapRoute(<CaseJourneyStandalonePage />)}
    />,
    <Route
      key="cases-detail"
      path="/cases/:id"
      element={wrapRoute(<CaseDetailPage />)}
    />,
    <Route
      key="cases-edit"
      path="/cases/:id/edit"
      element={wrapRoute(<CaseFormPage />)}
    />,
    // v0.37.1: canonical path is /cases/new. Old /add-new-record redirects.
    // Keep 1-2 releases for bookmarks/links, then remove.
    <Route
      key="cases-new"
      path="/cases/new"
      element={wrapRoute(<CaseFormPage />)}
    />,
    <Route
      key="cases-new-legacy-redirect"
      path="/add-new-record"
      element={<Navigate to="/cases/new" replace />}
    />,
    // v0.37.1: /comprehensive-list and /initial-cases moved to features/comprehensive/routes.tsx
    <Route
      key="cases-tdc-backfill"
      path="/cases/tdac-backfill"
      element={wrapRoute(<CaseTdcBackfillPage />)}
    />,
  ];
}
