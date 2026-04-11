import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '@/pages/auth/LoginPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { MainLayout } from '@/layouts/MainLayout';

// Lazy-loaded pages — real implementations
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const UserManagementPage = lazy(() => import('@/pages/users/UserManagementPage'));
const DirectoriesPage = lazy(() => import('@/pages/directories/DirectoriesPage'));
const MasterClassPage = lazy(() => import('@/pages/admin/MasterClassPage'));
const TeamsPage = lazy(() => import('@/pages/admin/TeamsPage'));

// Lazy-loaded pages — Quan ly doi tuong (TASK-2026-261224 / 261225)
const ObjectListPage = lazy(() => import('@/pages/objects/ObjectListPage'));
const VictimsListPage = lazy(() => import('@/pages/objects/VictimsListPage'));
const WitnessesListPage = lazy(() => import('@/pages/objects/WitnessesListPage'));
const LawyerListPage = lazy(() => import('@/pages/lawyers/LawyerListPage'));

// Lazy-loaded pages — Quan ly vu an (TASK-000006)
const CaseListPage = lazy(() => import('@/pages/cases/CaseListPage'));
const CaseFormPage = lazy(() => import('@/pages/cases/CaseFormPage'));
const CaseDetailPage = lazy(() => import('@/pages/cases/CaseDetailPage'));
const ComprehensiveListPage = lazy(() => import('@/pages/cases/ComprehensiveListPage'));
const InitialCasesPage = lazy(() => import('@/pages/cases/InitialCasesPage'));

// Lazy-loaded pages — Quan ly don thu (TASK-2026-260202)
const PetitionListPage = lazy(() => import('@/pages/petitions/PetitionListPage'));
const PetitionFormPage = lazy(() => import('@/pages/petitions/PetitionFormPage'));

// Lazy-loaded pages — Quan ly vu viec (TASK-2026-022601)
const IncidentListPage = lazy(() => import('@/pages/incidents/IncidentListPage'));
const IncidentFormPage = lazy(() => import('@/pages/incidents/IncidentFormPage'));

// Lazy-loaded pages — Quy trình xử lý (TASK-2026-260216)
const TransferAndReturnPage = lazy(() => import('@/pages/workflow/TransferAndReturnPage'));
const PetitionGuidancePage = lazy(() => import('@/pages/workflow/PetitionGuidancePage'));
const CaseExchangePage = lazy(() => import('@/pages/workflow/CaseExchangePage'));
const InvestigationDelegationPage = lazy(() => import('@/pages/workflow/InvestigationDelegationPage'));

// Lazy-loaded pages — Phân loại & Quản lý (TASK-2026-022601)
const WardCasesPage = lazy(() => import('@/pages/classification/WardCasesPage'));
const WardIncidentsPage = lazy(() => import('@/pages/classification/WardIncidentsPage'));
const ProsecutorProposalPage = lazy(() => import('@/pages/classification/ProsecutorProposalPage'));
const DuplicatePetitionsPage = lazy(() => import('@/pages/classification/DuplicatePetitionsPage'));
const OtherClassificationPage = lazy(() => import('@/pages/classification/OtherClassificationPage'));

// System Module (TASK-2026-022601)
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const DocumentsPage = lazy(() => import('@/pages/system/DocumentsPage'));

// Lazy-loaded pages — Báo cáo & Thống kê (TASK-2026-000001)
const ExportReportsPage = lazy(() => import('@/pages/reports/ExportReportsPage'));
const ActivityLogPage = lazy(() => import('@/pages/reports/ActivityLogPage'));
const OverdueRecordsPage = lazy(() => import('@/pages/reports/OverdueRecordsPage'));
const DistrictStatisticsPage = lazy(() => import('@/pages/reports/DistrictStatisticsPage'));
const MonthlyReportPage = lazy(() => import('@/pages/reports/MonthlyReportPage'));
const QuarterlyReportPage = lazy(() => import('@/pages/reports/QuarterlyReportPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes under MainLayout */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* ── Implemented pages ──────────────────────── */}
            <Route path="/dashboard" element={
              <Suspense fallback={null}><DashboardPage /></Suspense>
            } />
            <Route path="/nguoi-dung" element={
              <Suspense fallback={null}><UserManagementPage /></Suspense>
            } />
            <Route path="/danh-muc" element={
              <Suspense fallback={null}><DirectoriesPage /></Suspense>
            } />
            <Route path="/phan-loai" element={
              <Suspense fallback={null}><MasterClassPage /></Suspense>
            } />
            <Route path="/to-nhom" element={
              <Suspense fallback={null}><TeamsPage /></Suspense>
            } />

            {/* ── Quan ly vu an — Real implementations ───── */}
            <Route path="/cases" element={
              <Suspense fallback={null}><CaseListPage /></Suspense>
            } />
            <Route path="/cases/:id" element={
              <Suspense fallback={null}><CaseDetailPage /></Suspense>
            } />
            <Route path="/cases/:id/edit" element={
              <Suspense fallback={null}><CaseFormPage /></Suspense>
            } />
            <Route path="/add-new-record" element={
              <Suspense fallback={null}><CaseFormPage /></Suspense>
            } />
            <Route path="/comprehensive-list" element={
              <Suspense fallback={null}><ComprehensiveListPage /></Suspense>
            } />
            <Route path="/initial-cases" element={
              <Suspense fallback={null}><InitialCasesPage /></Suspense>
            } />

            {/* ── Quan ly doi tuong — Real implementation ── */}
            <Route path="/objects" element={
              <Suspense fallback={null}><ObjectListPage /></Suspense>
            } />

            {/* ── Nghiep vu chinh — Coming Soon ──────────── */}
            {/* TASK-2026-260201: /people/suspects → ObjectListPage */}
            <Route path="/people/suspects" element={
              <Suspense fallback={null}><ObjectListPage /></Suspense>
            } />
            {/* TASK-2026-261225: victims + witnesses + lawyers */}
            <Route path="/people/victims" element={
              <Suspense fallback={null}><VictimsListPage /></Suspense>
            } />
            <Route path="/people/witnesses" element={
              <Suspense fallback={null}><WitnessesListPage /></Suspense>
            } />

            {/* ── Quan ly don thu — Real implementations (TASK-2026-260202) ── */}
            <Route path="/petitions" element={
              <Suspense fallback={null}><PetitionListPage /></Suspense>
            } />
            <Route path="/petitions/new" element={
              <Suspense fallback={null}><PetitionFormPage /></Suspense>
            } />
            <Route path="/petitions/:id/edit" element={
              <Suspense fallback={null}><PetitionFormPage /></Suspense>
            } />

            {/* ── Quan ly vu viec — Real implementations (TASK-2026-022601) ── */}
            <Route path="/vu-viec" element={
              <Suspense fallback={null}><IncidentListPage /></Suspense>
            } />
            <Route path="/vu-viec/new" element={
              <Suspense fallback={null}><IncidentFormPage /></Suspense>
            } />
            <Route path="/vu-viec/:id/edit" element={
              <Suspense fallback={null}><IncidentFormPage /></Suspense>
            } />
            <Route path="/incidents" element={
              <Suspense fallback={null}><IncidentListPage /></Suspense>
            } />

            {/* ── Quy trình xử lý — Real implementations (TASK-2026-260216) ── */}
            <Route path="/transfer-return" element={
              <Suspense fallback={null}><TransferAndReturnPage /></Suspense>
            } />
            <Route path="/guidance" element={
              <Suspense fallback={null}><PetitionGuidancePage /></Suspense>
            } />
            <Route path="/case-exchange" element={
              <Suspense fallback={null}><CaseExchangePage /></Suspense>
            } />
            <Route path="/investigation-delegation" element={
              <Suspense fallback={null}><InvestigationDelegationPage /></Suspense>
            } />

            {/* ── Phân loại & Quản lý — Real implementations (TASK-2026-022601) ── */}
            <Route path="/ward/cases" element={
              <Suspense fallback={null}><WardCasesPage /></Suspense>
            } />
            <Route path="/ward/incidents" element={
              <Suspense fallback={null}><WardIncidentsPage /></Suspense>
            } />
            <Route path="/prosecutor-proposal" element={
              <Suspense fallback={null}><ProsecutorProposalPage /></Suspense>
            } />
            <Route path="/classification/duplicates" element={
              <Suspense fallback={null}><DuplicatePetitionsPage /></Suspense>
            } />
            <Route path="/classification/others" element={
              <Suspense fallback={null}><OtherClassificationPage /></Suspense>
            } />
            <Route path="/lawyers" element={
              <Suspense fallback={null}><LawyerListPage /></Suspense>
            } />

            {/* ── Báo cáo & Thống kê — Real implementations (TASK-2026-000001) ── */}
            <Route path="/export-reports" element={
              <Suspense fallback={null}><ExportReportsPage /></Suspense>
            } />
            <Route path="/reports/monthly" element={
              <Suspense fallback={null}><MonthlyReportPage /></Suspense>
            } />
            <Route path="/reports/quarterly" element={
              <Suspense fallback={null}><QuarterlyReportPage /></Suspense>
            } />
            <Route path="/statistics/district" element={
              <Suspense fallback={null}><DistrictStatisticsPage /></Suspense>
            } />
            <Route path="/settings/overdue-records" element={
              <Suspense fallback={null}><OverdueRecordsPage /></Suspense>
            } />
            <Route path="/activity-log" element={
              <Suspense fallback={null}><ActivityLogPage /></Suspense>
            } />

            {/* ── Hệ thống — Real implementations (TASK-2026-022601) ── */}
            <Route path="/documents" element={
              <Suspense fallback={null}><DocumentsPage /></Suspense>
            } />
            <Route path="/calendar" element={
              <Suspense fallback={null}><CalendarPage /></Suspense>
            } />
            <Route path="/settings" element={
              <Suspense fallback={null}><SettingsPage /></Suspense>
            } />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
