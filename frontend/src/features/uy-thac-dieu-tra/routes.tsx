import { lazy, type ReactElement } from 'react';
import { Route, Navigate, useParams } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const UyThacDieuTraListPage = lazy(() => import('./UyThacDieuTraListPage'));


function RedirectToEdit(): ReactElement {
  const { id } = useParams<{ id: string }>();
  // Bug 1 fix: thêm caseProvenance để CaseFormPage hiển thị tab UTDT ngay lập tức
  // (không cần đợi API response mới thấy tab "Thông tin Ủy thác")
  return <Navigate to={`/cases/${id}/edit?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra`} replace />;
}

export function renderUyThacDieuTraRoutes(): ReactElement[] {
  return [
    <Route
      key="utdt-list"
      path="/uy-thac-dieu-tra"
      element={wrapRoute(<UyThacDieuTraListPage />)}
    />,
    <Route
      key="utdt-new"
      path="/uy-thac-dieu-tra/new"
      element={<Navigate to="/cases/new?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra" replace />}
    />,
    <Route
      key="utdt-edit"
      path="/uy-thac-dieu-tra/:id/edit"
      element={<RedirectToEdit />}
    />,
  ];
}
