import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

// F1 swap (v0.56): PetitionListPageShell (PR2 ListPageShell) replaces legacy.
const PetitionListPage = lazy(() => import('@/pages/petitions/PetitionListPageShell'));
const PetitionFormPage = lazy(() => import('@/pages/petitions/PetitionFormPage'));
// v0.37.1: Đơn thư theo phường/xã page (mirror WardCasesPage/WardIncidentsPage pattern)
const WardPetitionsPage = lazy(() => import('@/pages/petitions/WardPetitionsPage'));


export function renderPetitionsRoutes(): ReactElement[] {
  return [
    <Route key="petitions-list" path="/petitions" element={wrapRoute(<PetitionListPage />)} />,
    <Route key="petitions-new" path="/petitions/new" element={wrapRoute(<PetitionFormPage />)} />,
    // v0.67.1 fix: /petitions/:id alias. Without this, row click trên list shell
    // navigates to /petitions/:id → no route → catch-all `*` → redirect /login.
    // PetitionFormPage handles cả read+edit qua useParams id presence.
    <Route key="petitions-detail" path="/petitions/:id" element={wrapRoute(<PetitionFormPage />)} />,
    <Route key="petitions-edit" path="/petitions/:id/edit" element={wrapRoute(<PetitionFormPage />)} />,
    <Route key="petitions-ward" path="/ward/petitions" element={wrapRoute(<WardPetitionsPage />)} />,
  ];
}
