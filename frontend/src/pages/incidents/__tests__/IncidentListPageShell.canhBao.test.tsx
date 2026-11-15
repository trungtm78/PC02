/**
 * Cột "Cảnh báo" trên danh sách Vụ việc: chỉ có khi máy chủ trả `alert` trên từng dòng (công tắc
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
import { IncidentListPageShell } from '../IncidentListPageShell';

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
      <MemoryRouter initialEntries={[`/incidents${search}`]}>
        <CompositeModalProvider>
          <DeleteResourceModalProvider>
            <Routes>
              <Route path="/incidents" element={<><IncidentListPageShell /><LocationTracker /></>} />
              <Route path="/incidents/:id" element={<div>detail</div>} />
            </Routes>
          </DeleteResourceModalProvider>
        </CompositeModalProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { getLocation: () => location.current, unmount: view.unmount };
}

alertColumnSuite({
  name: 'the incident list',
  get: vi.mocked(api.get),
  listUrl: '/incidents',
  prefix: 'incidents',
  renderAt,
  exportTestId: 'btn-xuat-excel-theo-bo-loc',
  row: {
    id: 'incident-1',
    code: 'VV-2026-00001',
    name: 'Vụ việc mẫu',
    status: 'TIEP_NHAN',
    deadline: '2026-06-30T00:00:00Z',
    createdAt: '2026-05-20T00:00:00Z',
    updatedAt: '2026-05-21T00:00:00Z',
    quyenGhi: true,
  },
  stats: {
    total: 35,
    byStatus: { TIEP_NHAN: 5, DANG_XAC_MINH: 12 },
    byGroup: { 'tiep-nhan': 5, 'xac-minh': 16, 'ket-qua': 12, 'tam-dinh-chi': 2 },
  },
});
