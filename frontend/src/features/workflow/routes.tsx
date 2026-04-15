import { lazy, Suspense, type ReactElement } from 'react';
import { Route } from 'react-router-dom';

const TransferAndReturnPage = lazy(() => import('@/pages/workflow/TransferAndReturnPage'));
const PetitionGuidancePage = lazy(() => import('@/pages/workflow/PetitionGuidancePage'));
const CaseExchangePage = lazy(() => import('@/pages/workflow/CaseExchangePage'));
const InvestigationDelegationPage = lazy(() => import('@/pages/workflow/InvestigationDelegationPage'));

const wrap = (node: ReactElement): ReactElement => (
  <Suspense fallback={null}>{node}</Suspense>
);

export function renderWorkflowRoutes(): ReactElement[] {
  return [
    <Route key="workflow-transfer" path="/transfer-return" element={wrap(<TransferAndReturnPage />)} />,
    <Route key="workflow-guidance" path="/guidance" element={wrap(<PetitionGuidancePage />)} />,
    <Route key="workflow-exchange" path="/case-exchange" element={wrap(<CaseExchangePage />)} />,
    <Route key="workflow-delegation" path="/investigation-delegation" element={wrap(<InvestigationDelegationPage />)} />,
  ];
}
