/**
 * UyThacDieuTraListPage — PR3 refactor regression tests.
 *
 * Coverage:
 * - Page mounts → fetch /cases?caseType=UY_THAC_DIEU_TRA
 * - Row renders với caseCode, donViGiao, badges
 * - ListPageShell.Header title "Ủy Thác Điều Tra" rendered
 * - StatusChips (4 TrangThaiPhanHoi + "Tất cả") = 5 tabs
 * - Delete modal: open via row trash button → reason textarea → confirm
 * - DELETE /cases/:id called với reason body ≥ 10 chars (was P1 Codex finding)
 * - Modal validates reason min length client-side (button disabled when < 10)
 * - URL state: utdt_status filter passes to API as trangThaiPhanHoi
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockApiGet = vi.fn();
const mockApiDelete = vi.fn(() => Promise.resolve({ data: { success: true } }));

vi.mock('@/lib/api', () => ({
  api: {
    get: mockApiGet,
    delete: mockApiDelete,
  },
}));

const SAMPLE_ROW = {
  id: 'utdt-list-001',
  name: 'Ủy thác test delete',
  crime: null,
  caseCode: 'PC02-UTDT-2026-00001',
  status: 'TIEP_NHAN',
  donViGiao: 'PC01',
  soQuyetDinhUyThac: null,
  ngayTiepNhan: null,
  thoiHanUyThac: null,
  loaiUyThac: null,
  ketQuaUyThac: null,
  ngayTraKetQua: null,
  metadata: null,
  investigator: null,
  createdBy: null,
  createdAt: new Date().toISOString(),
};

function setupHappyFetch() {
  mockApiGet.mockImplementation(() =>
    Promise.resolve({
      data: {
        success: true,
        data: [SAMPLE_ROW],
        total: 1,
      },
    }),
  );
}

async function renderPage(initialEntry = '/uy-thac-dieu-tra') {
  const { default: Page } = await import('../UyThacDieuTraListPage');
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/uy-thac-dieu-tra" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UyThacDieuTraListPage — PR3 shell refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts → header "Ủy Thác Điều Tra" renders', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /Ủy Thác Điều Tra/i }),
    ).toBeInTheDocument();
  });

  it('fetches /cases?caseType=UY_THAC_DIEU_TRA on mount', async () => {
    await renderPage();
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('caseType=UY_THAC_DIEU_TRA');
    });
  });

  it('renders row với caseCode', async () => {
    await renderPage();
    const row = await screen.findByText('PC02-UTDT-2026-00001', {}, { timeout: 10000 });
    expect(row).toBeInTheDocument();
  });

  it('StatusChips render 4 TrangThaiPhanHoi + "Tất cả" = 5 tabs', async () => {
    await renderPage();
    await screen.findByText('PC02-UTDT-2026-00001');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('clicking Trash button opens delete modal', async () => {
    await renderPage();
    await screen.findByText('PC02-UTDT-2026-00001');

    const deleteBtn = screen.getByTitle('Xóa ủy thác');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('utdt-delete-reason')).toBeInTheDocument();
    });
  });

  it('delete modal button disabled khi reason < 10 chars', async () => {
    await renderPage();
    await screen.findByText('PC02-UTDT-2026-00001');

    fireEvent.click(screen.getByTitle('Xóa ủy thác'));
    await screen.findByTestId('utdt-delete-reason');

    const textarea = screen.getByTestId('utdt-delete-reason');
    fireEvent.change(textarea, { target: { value: 'ngắn' } });

    const confirmBtn = screen.getAllByTitle('Xóa ủy thác').find(
      (b) => b.textContent?.includes('Xác nhận'),
    );
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn).toBeDisabled();
  });

  it('delete với reason ≥ 10 chars → calls DELETE với reason body (was P1 Codex)', async () => {
    await renderPage();
    await screen.findByText('PC02-UTDT-2026-00001');

    fireEvent.click(screen.getByTitle('Xóa ủy thác'));
    const textarea = await screen.findByTestId('utdt-delete-reason');

    fireEvent.change(textarea, {
      target: { value: 'Trùng lặp với ủy thác PC02-UTDT-2026-00012 do nhập sai mã đơn vị giao.' },
    });

    const confirmBtn = screen.getAllByTitle('Xóa ủy thác').find(
      (b) => b.textContent?.includes('Xác nhận'),
    );
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);

    await waitFor(
      () => {
        expect(mockApiDelete).toHaveBeenCalledWith(
          '/cases/utdt-list-001',
          expect.objectContaining({
            data: expect.objectContaining({ reason: expect.any(String) }),
          }),
        );
      },
      { timeout: 5000 },
    );

    const callArgs = mockApiDelete.mock.calls[0];
    const reason: string = callArgs[1]?.data?.reason ?? '';
    expect(reason.length).toBeGreaterThanOrEqual(10);
  }, 20000);

  it('URL state utdt_status=QUA_HAN → passes trangThaiPhanHoi=QUA_HAN to API', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_status=QUA_HAN');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('trangThaiPhanHoi=QUA_HAN');
    });
  });

  it('malformed utdt_status URL param → ignored (trust boundary)', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_status=__proto__');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('trangThaiPhanHoi=__proto__');
    });
  });

  it('state=empty (no filter, no rows) → render plain empty CTA', async () => {
    mockApiGet.mockImplementation(() =>
      Promise.resolve({ data: { success: true, data: [], total: 0 } }),
    );
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Nhập ủy thác mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered (status active, no rows) → render filtered empty', async () => {
    mockApiGet.mockImplementation(() =>
      Promise.resolve({ data: { success: true, data: [], total: 0 } }),
    );
    await renderPage('/uy-thac-dieu-tra?utdt_status=QUA_HAN');
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });

  // /codex P2 trust-boundary tests (PR3/T7b)
  it('malformed utdt_cs (caseStatus) → stripped from API URL', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_cs=__proto__');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('status=__proto__');
    });
  });

  it('malformed utdt_lut (loaiUyThac) → stripped from API URL', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_lut=bogus_enum');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('loaiUyThac=bogus_enum');
    });
  });

  it('malformed utdt_tnf (date) → stripped, valid date passes through', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_tnf=not-a-date');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('ngayTiepNhanFrom=not-a-date');
    });
  });

  it('calendar-invalid utdt_tnf (2026-02-30) → stripped', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_tnf=2026-02-30');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('ngayTiepNhanFrom=2026-02-30');
    });
  });

  it('valid utdt_tnf (2026-01-15) → passed to API', async () => {
    await renderPage('/uy-thac-dieu-tra?utdt_tnf=2026-01-15');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('ngayTiepNhanFrom=2026-01-15');
    });
  });

  it('control chars in utdt_dv (donViGiao) → stripped', async () => {
    // utdt_dv contains tab (%09) + LF (%0A) — should be removed
    await renderPage('/uy-thac-dieu-tra?utdt_dv=PC01%09evil%0A');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      // donViGiao param present with PC01evil (control chars stripped)
      expect(url).toContain('donViGiao=PC01evil');
    });
  });

  // /codex P2 page-clamp test
  it('utdt_page=999 với total=20 → reset to page=1 (no impossible empty page)', async () => {
    // First call returns total=20 (1 page), at page=999
    mockApiGet.mockImplementation(() =>
      Promise.resolve({ data: { success: true, data: [SAMPLE_ROW], total: 20 } }),
    );
    let lastLocation = '';
    function LocationTracker() {
      const { useLocation } = require('react-router-dom');
      const loc = useLocation();
      lastLocation = loc.pathname + loc.search;
      return null;
    }
    const { default: Page } = await import('../UyThacDieuTraListPage');
    render(
      <MemoryRouter initialEntries={['/uy-thac-dieu-tra?utdt_page=999']}>
        <Routes>
          <Route
            path="/uy-thac-dieu-tra"
            element={
              <>
                <Page />
                <LocationTracker />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      // After totalCount=20 ≤ 1 page resolves, page clamps to 1
      expect(lastLocation).toContain('utdt_page=1');
    });
  });
});
