import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderCalendarRoutes(): ReactElement[] {
  return [
    <Route key="calendar" path="/calendar" element={wrap(<CalendarPage />)} />,
  ];
}
