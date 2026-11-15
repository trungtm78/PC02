/**
 * Cột "Cảnh báo" trên danh sách Đơn thư: chỉ có khi máy chủ trả `alert` trên từng dòng (công tắc
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
import { PetitionListPageShell } from '../PetitionListPageShell';

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
      <MemoryRouter initialEntries={[`/petitions${search}`]}>
        <CompositeModalProvider>
          <DeleteResourceModalProvider>
            <Routes>
              <Route path="/petitions" element={<><PetitionListPageShell /><LocationTracker /></>} />
              <Route path="/petitions/:id" element={<div>detail</div>} />
            </Routes>
          </DeleteResourceModalProvider>
        </CompositeModalProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { getLocation: () => location.current, unmount: view.unmount };
}

alertColumnSuite({
  name: 'the petition list',
  get: vi.mocked(api.get),
  listUrl: '/petitions',
  prefix: 'petitions',
  renderAt,
  exportTestId: 'btn-xuat-excel-theo-bo-loc',
  row: {
    id: 'petition-1',
    stt: '2026-00001',
    receivedDate: '2026-05-15T00:00:00Z',
    senderName: 'Nguyễn Văn A',
    status: 'MOI_TIEP_NHAN',
    deadline: '2026-06-30T00:00:00Z',
    createdAt: '2026-05-15T00:00:00Z',
  },
  stats: {
    total: 34,
    byStatus: { MOI_TIEP_NHAN: 8, DANG_XU_LY: 15 },
    byGroup: { 'moi-tiep-nhan': 8, 'dang-xu-ly': 17, 'da-giai-quyet': 8, 'da-luu-don': 1 },
  },
});
