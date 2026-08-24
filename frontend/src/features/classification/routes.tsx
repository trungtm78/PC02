import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const WardCasesPage = lazy(() => import('@/pages/classification/WardCasesPage'));
const WardIncidentsPage = lazy(() => import('@/pages/classification/WardIncidentsPage'));
const ProsecutorProposalPage = lazy(() => import('@/pages/classification/ProsecutorProposalPage'));
const DuplicatePetitionsPage = lazy(() => import('@/pages/classification/DuplicatePetitionsPage'));
const OtherClassificationPage = lazy(() => import('@/pages/classification/OtherClassificationPage'));


export function renderClassificationRoutes(): ReactElement[] {
  return [
    <Route key="classification-ward-cases" path="/ward/cases" element={wrapRoute(<WardCasesPage />)} />,
    <Route key="classification-ward-incidents" path="/ward/incidents" element={wrapRoute(<WardIncidentsPage />)} />,
    <Route key="classification-prosecutor" path="/prosecutor-proposal" element={wrapRoute(<ProsecutorProposalPage />)} />,
    <Route key="classification-duplicates" path="/classification/duplicates" element={wrapRoute(<DuplicatePetitionsPage />)} />,
    <Route key="classification-others" path="/classification/others" element={wrapRoute(<OtherClassificationPage />)} />,
  ];
}
