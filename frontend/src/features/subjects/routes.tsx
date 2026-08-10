import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

// F1 swap (v0.56): ObjectListPageShell (PR5 ListPageShell + bulk-delete v0.51).
// Polymorphic — single component handles SUSPECT/VICTIM/WITNESS via prop.
// Replaces legacy ObjectListPage + VictimsListPage + WitnessesListPage (thin
// wrappers over ObjectListPage). Legacy files kept on disk for ref.
const ObjectListPageShell = lazy(() => import('@/pages/objects/ObjectListPageShell'));
// D2/ND-16 — trước đây ba màn hình này chỉ liệt kê. `POST /subjects` có sẵn
// nhưng đường duy nhất gọi tới nó là form vụ án, nên không ai thêm được bị hại
// hay nhân chứng cho hồ sơ đã lập.
const SubjectCreatePage = lazy(() => import('@/pages/objects/SubjectCreatePage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderSubjectsRoutes(): ReactElement[] {
  return [
    <Route key="objects" path="/objects" element={wrap(<ObjectListPageShell subjectType="SUSPECT" />)} />,
    <Route key="suspects" path="/people/suspects" element={wrap(<ObjectListPageShell subjectType="SUSPECT" />)} />,
    <Route key="victims" path="/people/victims" element={wrap(<ObjectListPageShell subjectType="VICTIM" />)} />,
    <Route key="witnesses" path="/people/witnesses" element={wrap(<ObjectListPageShell subjectType="WITNESS" />)} />,
    <Route key="suspects-new" path="/people/suspects/new" element={wrap(<SubjectCreatePage subjectType="SUSPECT" />)} />,
    <Route key="victims-new" path="/people/victims/new" element={wrap(<SubjectCreatePage subjectType="VICTIM" />)} />,
    <Route key="witnesses-new" path="/people/witnesses/new" element={wrap(<SubjectCreatePage subjectType="WITNESS" />)} />,
  ];
}
