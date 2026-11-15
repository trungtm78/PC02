import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';
import { CALENDAR_PATH, FLOWS_PATH } from './menu';

const ProcessingFlowListPage = lazy(() => import('@/pages/admin/processing-flow/ProcessingFlowListPage'));
const ProcessingFlowEditorPage = lazy(() => import('@/pages/admin/processing-flow/ProcessingFlowEditorPage'));
const ProcessingCalendarListPage = lazy(() => import('@/pages/admin/processing-flow/ProcessingCalendarListPage'));
const ProcessingCalendarYearPage = lazy(() => import('@/pages/admin/processing-flow/ProcessingCalendarYearPage'));

export function renderProcessingFlowRoutes(): ReactElement[] {
  return [
    <Route key="processing-flow-list" path={FLOWS_PATH} element={wrapRoute(<ProcessingFlowListPage />)} />,
    <Route key="processing-flow-editor" path={`${FLOWS_PATH}/:id`} element={wrapRoute(<ProcessingFlowEditorPage />)} />,
    <Route key="processing-calendar-list" path={CALENDAR_PATH} element={wrapRoute(<ProcessingCalendarListPage />)} />,
    <Route key="processing-calendar-year" path={`${CALENDAR_PATH}/:year`} element={wrapRoute(<ProcessingCalendarYearPage />)} />,
  ];
}
