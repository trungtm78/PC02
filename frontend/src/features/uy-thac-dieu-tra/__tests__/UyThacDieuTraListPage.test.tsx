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
});
