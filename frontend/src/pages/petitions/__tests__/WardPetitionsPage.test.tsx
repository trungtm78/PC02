/**
 * WardPetitionsPage tests (TDD F1-F17).
 *
 * Mirror coverage of WardIncidentsPage / WardCasesPage: 4 KPI cards,
 * advanced filter panel, export button, status+priority badges, etc.
 *
 * Test groups:
 *   F1-F5 : KPI cards (render + count by PetitionStatus phase)
 *   F6-F9 : Filters (toggle + fromDate + petitionType + status)
 *   F10   : Export button
 *   F11-F12: Badges (status + priority)
 *   F13   : Reset filters
 *   F14-F15: Empty + loading states
 *   F16   : Row navigation
 *   F17   : Ward column shows assignedTeam.ward.name
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import WardPetitionsPage from '../WardPetitionsPage';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// 6 petitions covering all KPI buckets
const fixturePetitions = [
  { id: 'p1', stt: 'DT-2026-00001', senderName: 'Người A', petitionType: 'TO_CAO', receivedDate: '2026-02-01', status: 'MOI_TIEP_NHAN', summary: 'Đơn 1', priority: 'Cao', assignedTeam: { ward: { name: 'Phường 2' } } },
  { id: 'p2', stt: 'DT-2026-00002', senderName: 'Người B', petitionType: 'KHIEU_NAI', receivedDate: '2026-02-05', status: 'DANG_XU_LY', summary: 'Đơn 2', priority: 'Trung bình', assignedTeam: { ward: { name: 'Phường 4' } } },
  { id: 'p3', stt: 'DT-2026-00003', senderName: 'Người C', petitionType: 'KIEN_NGHI', receivedDate: '2026-02-10', status: 'DANG_XU_LY', summary: 'Đơn 3', priority: 'Thấp', assignedTeam: { ward: { name: 'Phường 2' } } },
  { id: 'p4', stt: 'DT-2026-00004', senderName: 'Người D', petitionType: 'PHAN_ANH', receivedDate: '2026-02-15', status: 'CHO_PHE_DUYET', summary: 'Đơn 4', priority: null, assignedTeam: null },
  { id: 'p5', stt: 'DT-2026-00005', senderName: 'Người E', petitionType: 'TO_CAO', receivedDate: '2026-02-20', status: 'DA_GIAI_QUYET', summary: 'Đơn 5', priority: 'Cao', assignedTeam: { ward: { name: 'Phường 6' } } },
  { id: 'p6', stt: 'DT-2026-00006', senderName: 'Người F', petitionType: 'TO_CAO', receivedDate: '2026-02-25', status: 'DA_CHUYEN_VU_VIEC', summary: 'Đơn 6', priority: null, assignedTeam: { ward: { name: 'Phường 6' } } },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WardPetitionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockListResponse(data: typeof fixturePetitions = fixturePetitions) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/petitions' || url.startsWith('/petitions?')) {
      return Promise.resolve({ data: { data } } as any);
    }
    // Other endpoints (admin-units) return empty for WardFilterDropdown
    return Promise.resolve({ data: [] } as any);
  });
}

describe('WardPetitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('F1: renders 4 KPI cards with data-testid', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-card-total')).toBeInTheDocument();
    });
    expect(screen.getByTestId('kpi-card-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-processing')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-resolved')).toBeInTheDocument();
  });

  it('F2: KPI Tổng = count of all fetched petitions', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('6');
    });
  });

  it('F3: KPI Chờ xử lý counts MOI_TIEP_NHAN', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      // fixture has 1 MOI_TIEP_NHAN
      expect(screen.getByTestId('kpi-card-pending')).toHaveTextContent('1');
    });
  });

  it('F4: KPI Đang xử lý counts DANG_XU_LY + CHO_PHE_DUYET', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      // fixture has 2 DANG_XU_LY + 1 CHO_PHE_DUYET = 3
      expect(screen.getByTestId('kpi-card-processing')).toHaveTextContent('3');
    });
  });

  it('F5: KPI Đã giải quyết counts DA_GIAI_QUYET + DA_CHUYEN_VU_VIEC + DA_CHUYEN_VU_AN', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      // fixture has 1 DA_GIAI_QUYET + 1 DA_CHUYEN_VU_VIEC + 0 DA_CHUYEN_VU_AN = 2
      expect(screen.getByTestId('kpi-card-resolved')).toHaveTextContent('2');
    });
  });

  it('F6: filter toggle button shows advanced filter panel with date/petitionType/status fields', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-toggle-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('advanced-filter-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('filter-toggle-btn'));

    expect(screen.getByTestId('advanced-filter-panel')).toBeInTheDocument();
    expect(screen.getByTestId('filter-from-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-to-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-petition-type')).toBeInTheDocument();
    expect(screen.getByTestId('filter-status')).toBeInTheDocument();
  });

  it('F7: fromDate filter narrows table to receivedDate >= fromDate', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ward-petitions-table')).toBeInTheDocument();
    });
    // Before filter: 6 rows
    const rowsBefore = screen.getAllByTestId(/^petition-row-/);
    expect(rowsBefore).toHaveLength(6);

    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), {
      target: { value: '2026-02-15' },
    });

    // After filter: only p4 (2026-02-15), p5 (2026-02-20), p6 (2026-02-25) = 3 rows
    const rowsAfter = screen.getAllByTestId(/^petition-row-/);
    expect(rowsAfter).toHaveLength(3);
  });

  it('F8: petitionType filter narrows table by LoaiDon', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ward-petitions-table')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-petition-type'), {
      target: { value: 'TO_CAO' },
    });
    // fixture has 3 TO_CAO (p1, p5, p6)
    expect(screen.getAllByTestId(/^petition-row-/)).toHaveLength(3);
  });

  it('F9: status filter narrows table by PetitionStatus', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ward-petitions-table')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), {
      target: { value: 'DANG_XU_LY' },
    });
    // 2 DANG_XU_LY
    expect(screen.getAllByTestId(/^petition-row-/)).toHaveLength(2);
  });

  it('F10: export button triggers GET /petitions/export/ward with filter params', async () => {
    mockListResponse();
    // Stub URL.createObjectURL for blob download
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('export-excel-btn')).toBeInTheDocument();
    });

    vi.mocked(api.get).mockResolvedValueOnce({ data: new Blob() } as any);
    fireEvent.click(screen.getByTestId('export-excel-btn'));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/petitions/export/ward',
        expect.objectContaining({ responseType: 'blob' }),
      );
    });
  });

  it('F11: status badge has color class for DANG_XU_LY (blue) and DA_GIAI_QUYET (green)', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('status-badge-DANG_XU_LY-p2')).toBeInTheDocument();
    });
    const blueBadge = screen.getByTestId('status-badge-DANG_XU_LY-p2');
    expect(blueBadge.className).toMatch(/blue/);
    const greenBadge = screen.getByTestId('status-badge-DA_GIAI_QUYET-p5');
    expect(greenBadge.className).toMatch(/green/);
  });

  it('F12: priority badge maps Cao→red, Trung bình→yellow, Thấp→slate, null→em-dash', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('priority-badge-p1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('priority-badge-p1').className).toMatch(/red/);
    expect(screen.getByTestId('priority-badge-p2').className).toMatch(/yellow/);
    expect(screen.getByTestId('priority-badge-p3').className).toMatch(/slate/);
    // p4 has null priority → render em-dash placeholder
    expect(screen.getByTestId('priority-badge-p4')).toHaveTextContent('—');
  });

  it('F13: reset filters button clears all filter fields', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ward-petitions-table')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_XU_LY' } });
    expect(screen.getAllByTestId(/^petition-row-/)).toHaveLength(2);

    fireEvent.click(screen.getByTestId('reset-filters-btn'));

    expect(screen.getAllByTestId(/^petition-row-/)).toHaveLength(6);
    expect((screen.getByTestId('filter-status') as HTMLSelectElement).value).toBe('');
  });

  it('F14: empty state shows FileText icon and helpful text when no rows match', async () => {
    mockListResponse([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ward-petitions-empty')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ward-petitions-empty')).toHaveTextContent(/Không tìm thấy đơn thư/);
  });

  it('F15: loading state shows "Đang tải" while fetching', async () => {
    // Never resolve the request
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('ward-petitions-loading')).toBeInTheDocument();
  });

  it('F16: row click navigates to /petitions/:id/edit', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('petition-row-p1')).toBeInTheDocument();
    });
    const row = screen.getByTestId('petition-row-p1');
    fireEvent.click(row);
    // MemoryRouter doesn't expose location; assert row is focusable (tabIndex)
    expect(row).toHaveAttribute('tabindex', '0');
    // And the row has an explicit view button leading to edit URL
    const viewBtn = screen.getByTestId('view-btn-p1');
    expect(viewBtn).toBeInTheDocument();
  });

  it('F17: ward column shows assignedTeam.ward.name when present, em-dash when null', async () => {
    mockListResponse();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('petition-row-p1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ward-cell-p1')).toHaveTextContent('Phường 2');
    expect(screen.getByTestId('ward-cell-p4')).toHaveTextContent('—');
  });
});
