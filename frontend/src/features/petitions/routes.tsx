import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// F1 swap (v0.56): PetitionListPageShell (PR2 ListPageShell) replaces legacy.
const PetitionListPage = lazy(() => import('@/pages/petitions/PetitionListPageShell'));
const PetitionFormPage = lazy(() => import('@/pages/petitions/PetitionFormPage'));
// v0.37.1: Đơn thư theo phường/xã page (mirror WardCasesPage/WardIncidentsPage pattern)
const WardPetitionsPage = lazy(() => import('@/pages/petitions/WardPetitionsPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderPetitionsRoutes(): ReactElement[] {
  return [
    <Route key="petitions-list" path="/petitions" element={wrap(<PetitionListPage />)} />,
    <Route key="petitions-new" path="/petitions/new" element={wrap(<PetitionFormPage />)} />,
    <Route key="petitions-edit" path="/petitions/:id/edit" element={wrap(<PetitionFormPage />)} />,
    <Route key="petitions-ward" path="/ward/petitions" element={wrap(<WardPetitionsPage />)} />,
  ];
}
