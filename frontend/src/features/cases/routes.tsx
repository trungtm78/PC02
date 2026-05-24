import { lazy, Suspense, type ReactElement } from 'react';
import { Route, Navigate } from 'react-router-dom';

const CaseListPage = lazy(() => import('@/pages/cases/CaseListPage'));
const CaseFormPage = lazy(() => import('@/pages/cases/CaseFormPage'));
const CaseDetailPage = lazy(() => import('@/pages/cases/CaseDetailPage'));
// v0.37.1: ComprehensiveListPage + InitialCasesPage routes moved to features/comprehensive/routes.tsx
const CaseTdcBackfillPage = lazy(() => import('@/pages/cases/CaseTdcBackfillPage'));
const CaseJourneyStandalonePage = lazy(() => import('@/pages/cases/CaseJourneyStandalonePage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderCasesRoutes(): ReactElement[] {
  return [
    <Route
      key="cases-list"
      path="/cases"
      element={wrap(<CaseListPage />)}
    />,
    <Route
      key="cases-journey-standalone"
      path="/cases/:id/journey"
      element={wrap(<CaseJourneyStandalonePage />)}
    />,
    <Route
      key="cases-detail"
      path="/cases/:id"
      element={wrap(<CaseDetailPage />)}
    />,
    <Route
      key="cases-edit"
      path="/cases/:id/edit"
      element={wrap(<CaseFormPage />)}
    />,
    // v0.37.1: canonical path is /cases/new. Old /add-new-record redirects.
    // Keep 1-2 releases for bookmarks/links, then remove.
    <Route
      key="cases-new"
      path="/cases/new"
      element={wrap(<CaseFormPage />)}
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
      element={wrap(<CaseTdcBackfillPage />)}
    />,
  ];
}
