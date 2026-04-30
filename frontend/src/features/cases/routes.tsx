import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const CaseListPage = lazy(() => import('@/pages/cases/CaseListPage'));
const CaseFormPage = lazy(() => import('@/pages/cases/CaseFormPage'));
const CaseDetailPage = lazy(() => import('@/pages/cases/CaseDetailPage'));
const ComprehensiveListPage = lazy(
  () => import('@/pages/cases/ComprehensiveListPage'),
);
const InitialCasesPage = lazy(() => import('@/pages/cases/InitialCasesPage'));
const CaseTdcBackfillPage = lazy(() => import('@/pages/cases/CaseTdcBackfillPage'));

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
      key="cases-detail"
      path="/cases/:id"
      element={wrap(<CaseDetailPage />)}
    />,
    <Route
      key="cases-edit"
      path="/cases/:id/edit"
      element={wrap(<CaseFormPage />)}
    />,
    <Route
      key="cases-new"
      path="/add-new-record"
      element={wrap(<CaseFormPage />)}
    />,
    <Route
      key="cases-comprehensive"
      path="/comprehensive-list"
      element={wrap(<ComprehensiveListPage />)}
    />,
    <Route
      key="cases-initial"
      path="/initial-cases"
      element={wrap(<InitialCasesPage />)}
    />,
    <Route
      key="cases-tdc-backfill"
      path="/cases/tdac-backfill"
      element={wrap(<CaseTdcBackfillPage />)}
    />,
  ];
}
