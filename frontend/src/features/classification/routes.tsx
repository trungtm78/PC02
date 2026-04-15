import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const WardCasesPage = lazy(() => import('@/pages/classification/WardCasesPage'));
const WardIncidentsPage = lazy(() => import('@/pages/classification/WardIncidentsPage'));
const ProsecutorProposalPage = lazy(() => import('@/pages/classification/ProsecutorProposalPage'));
const DuplicatePetitionsPage = lazy(() => import('@/pages/classification/DuplicatePetitionsPage'));
const OtherClassificationPage = lazy(() => import('@/pages/classification/OtherClassificationPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderClassificationRoutes(): ReactElement[] {
  return [
    <Route key="classification-ward-cases" path="/ward/cases" element={wrap(<WardCasesPage />)} />,
    <Route key="classification-ward-incidents" path="/ward/incidents" element={wrap(<WardIncidentsPage />)} />,
    <Route key="classification-prosecutor" path="/prosecutor-proposal" element={wrap(<ProsecutorProposalPage />)} />,
    <Route key="classification-duplicates" path="/classification/duplicates" element={wrap(<DuplicatePetitionsPage />)} />,
    <Route key="classification-others" path="/classification/others" element={wrap(<OtherClassificationPage />)} />,
  ];
}
