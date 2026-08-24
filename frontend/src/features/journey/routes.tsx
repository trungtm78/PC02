import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const HoSoJourneyPage = lazy(() => import('./HoSoJourneyPage'));


export function renderJourneyRoutes(): ReactElement[] {
  return [
    <Route
      key="ho-so-journey"
      path="/ho-so-journey"
      element={wrapRoute(<HoSoJourneyPage />)}
    />,
  ];
}
