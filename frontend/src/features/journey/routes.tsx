import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const HoSoJourneyPage = lazy(() => import('./HoSoJourneyPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderJourneyRoutes(): ReactElement[] {
  return [
    <Route
      key="ho-so-journey"
      path="/ho-so-journey"
      element={wrap(<HoSoJourneyPage />)}
    />,
  ];
}
