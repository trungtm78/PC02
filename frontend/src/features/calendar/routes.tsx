import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));


export function renderCalendarRoutes(): ReactElement[] {
  return [
    <Route key="calendar" path="/calendar" element={wrapRoute(<CalendarPage />)} />,
  ];
}
