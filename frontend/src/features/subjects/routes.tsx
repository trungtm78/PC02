import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// F1 swap (v0.56): ObjectListPageShell (PR5 ListPageShell + bulk-delete v0.51).
// Polymorphic — single component handles SUSPECT/VICTIM/WITNESS via prop.
// Replaces legacy ObjectListPage + VictimsListPage + WitnessesListPage (thin
// wrappers over ObjectListPage). Legacy files kept on disk for ref.
const ObjectListPageShell = lazy(() => import('@/pages/objects/ObjectListPageShell'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderSubjectsRoutes(): ReactElement[] {
  return [
    <Route key="objects" path="/objects" element={wrap(<ObjectListPageShell subjectType="SUSPECT" />)} />,
    <Route key="suspects" path="/people/suspects" element={wrap(<ObjectListPageShell subjectType="SUSPECT" />)} />,
    <Route key="victims" path="/people/victims" element={wrap(<ObjectListPageShell subjectType="VICTIM" />)} />,
    <Route key="witnesses" path="/people/witnesses" element={wrap(<ObjectListPageShell subjectType="WITNESS" />)} />,
  ];
}
