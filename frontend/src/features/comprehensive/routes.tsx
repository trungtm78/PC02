import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

// v0.37.1: routes moved from features/cases/ — pages stay at pages/cases/ for
// historical reasons (file path migration deferred to keep diff smaller).
// Only the menu/feature ownership changed: now grouped under "Tổng hợp".
// F1 swap (v0.56): ComprehensiveListPageShell (PR2 ListPageShell) replaces legacy.
const ComprehensiveListPage = lazy(() => import('@/pages/cases/ComprehensiveListPageShell'));
const InitialCasesPage = lazy(() => import('@/pages/cases/InitialCasesPage'));
const JourneyPage = lazy(() => import('@/pages/journey/JourneyPage'));


export function renderComprehensiveRoutes(): ReactElement[] {
  return [
    <Route
      key="comprehensive-list"
      path="/comprehensive-list"
      element={wrapRoute(<ComprehensiveListPage />)}
    />,
    <Route
      key="comprehensive-initial"
      path="/initial-cases"
      element={wrapRoute(<InitialCasesPage />)}
    />,
    <Route
      key="journey"
      path="/journey"
      element={wrapRoute(<JourneyPage />)}
    />,
  ];
}
