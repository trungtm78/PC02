import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const PetitionListPage = lazy(() => import('@/pages/petitions/PetitionListPage'));
const PetitionFormPage = lazy(() => import('@/pages/petitions/PetitionFormPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderPetitionsRoutes(): ReactElement[] {
  return [
    <Route key="petitions-list" path="/petitions" element={wrap(<PetitionListPage />)} />,
    <Route key="petitions-new" path="/petitions/new" element={wrap(<PetitionFormPage />)} />,
    <Route key="petitions-edit" path="/petitions/:id/edit" element={wrap(<PetitionFormPage />)} />,
  ];
}
