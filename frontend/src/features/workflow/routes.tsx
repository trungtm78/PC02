import { lazy, type ReactElement } from 'react';
import { Route } from 'react-router-dom';
import { wrapRoute } from '@/lib/features/wrapRoute';

const TransferAndReturnPage = lazy(() => import('@/pages/workflow/TransferAndReturnPage'));
const PetitionGuidancePage = lazy(() => import('@/pages/workflow/PetitionGuidancePage'));
const CaseExchangePage = lazy(() => import('@/pages/workflow/CaseExchangePage'));
const InvestigationDelegationPage = lazy(() => import('@/pages/workflow/InvestigationDelegationPage'));


export function renderWorkflowRoutes(): ReactElement[] {
  return [
    <Route key="workflow-transfer" path="/transfer-return" element={wrapRoute(<TransferAndReturnPage />)} />,
    <Route key="workflow-guidance" path="/guidance" element={wrapRoute(<PetitionGuidancePage />)} />,
    <Route key="workflow-exchange" path="/case-exchange" element={wrapRoute(<CaseExchangePage />)} />,
    <Route key="workflow-delegation" path="/investigation-delegation" element={wrapRoute(<InvestigationDelegationPage />)} />,
  ];
}
