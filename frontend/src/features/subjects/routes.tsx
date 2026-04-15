import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const ObjectListPage = lazy(() => import('@/pages/objects/ObjectListPage'));
const VictimsListPage = lazy(() => import('@/pages/objects/VictimsListPage'));
const WitnessesListPage = lazy(() => import('@/pages/objects/WitnessesListPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderSubjectsRoutes(): ReactElement[] {
  return [
    <Route key="objects" path="/objects" element={wrap(<ObjectListPage />)} />,
    <Route key="suspects" path="/people/suspects" element={wrap(<ObjectListPage />)} />,
    <Route key="victims" path="/people/victims" element={wrap(<VictimsListPage />)} />,
    <Route key="witnesses" path="/people/witnesses" element={wrap(<WitnessesListPage />)} />,
  ];
}
