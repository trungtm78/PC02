import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// v0.37.1: routes moved from features/cases/ — pages stay at pages/cases/ for
// historical reasons (file path migration deferred to keep diff smaller).
// Only the menu/feature ownership changed: now grouped under "Tổng hợp".
const ComprehensiveListPage = lazy(() => import('@/pages/cases/ComprehensiveListPage'));
const InitialCasesPage = lazy(() => import('@/pages/cases/InitialCasesPage'));
const JourneyPage = lazy(() => import('@/pages/journey/JourneyPage'));

const wrap = (node: ReactElement): ReactElement => <Suspense fallback={null}>{node}</Suspense>;

export function renderComprehensiveRoutes(): ReactElement[] {
  return [
    <Route
      key="comprehensive-list"
      path="/comprehensive-list"
      element={wrap(<ComprehensiveListPage />)}
    />,
    <Route
      key="comprehensive-initial"
      path="/initial-cases"
      element={wrap(<InitialCasesPage />)}
    />,
    <Route
      key="journey"
      path="/journey"
      element={wrap(<JourneyPage />)}
    />,
  ];
}
