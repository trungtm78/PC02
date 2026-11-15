/**
 * Cột "Cảnh báo" trên danh sách Vụ án: chỉ có khi máy chủ trả `alert` trên từng dòng (công tắc
 * `processing_flow_records` bật). Bộ ca dùng chung cho cả ba danh sách nằm ở
 * `features/processing-flow/alerts/__tests__/listPageSuite.tsx`.
 */
import { useEffect } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { CompositeModalProvider } from '@/features/_shared/modals/CompositeModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { alertColumnSuite } from '@/features/processing-flow/alerts/__tests__/listPageSuite';
import { CaseListPageShell } from '../CaseListPageShell';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));

function renderAt(search: string) {
  const location = { current: '' };
  function LocationTracker() {
    const loc = useLocation();
    useEffect(() => {
      location.current = loc.pathname + loc.search;
    }, [loc.pathname, loc.search]);
    return null;
  }
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/cases${search}`]}>
        <CompositeModalProvider>
          <DeleteResourceModalProvider>
            <Routes>
              <Route path="/cases" element={<><CaseListPageShell /><LocationTracker /></>} />
              <Route path="/cases/:id" element={<div>detail</div>} />
            </Routes>
          </DeleteResourceModalProvider>
        </CompositeModalProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { getLocation: () => location.current, unmount: view.unmount };
}

alertColumnSuite({
  name: 'the case list',
  get: vi.mocked(api.get),
  listUrl: '/cases',
  prefix: 'cases',
  renderAt,
  exportTestId: 'btn-xuat-excel-theo-bo-loc',
  row: {
    id: 'case-1',
    caseCode: 'PC02-001',
    name: 'Vụ án mẫu',
    status: 'TIEP_NHAN',
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-21T00:00:00Z',
  },
  stats: {
    total: 100,
    byStatus: { TIEP_NHAN: 12, DANG_DIEU_TRA: 45 },
    byGroup: { 'dang-dieu-tra': 90, 'da-ket-luan': 5, 'dinh-chi': 2, 'tam-dinh-chi': 3 },
  },
});
