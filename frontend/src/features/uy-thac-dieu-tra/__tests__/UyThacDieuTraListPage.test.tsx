/**
 * UyThacDieuTraListPage — delete reason body test.
 *
 * P1 (Codex): DELETE /cases/:id without reason body → 400 from DeleteCaseDto.
 * Fix: pass { data: { reason: 'Xóa ủy thác điều tra theo yêu cầu' } }.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockApiDelete = vi.fn(() => Promise.resolve({ data: { success: true } }));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() =>
      Promise.resolve({
        data: {
          success: true,
          data: [
            {
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
            },
          ],
          total: 1,
        },
      }),
    ),
    delete: mockApiDelete,
  },
}));

async function renderPage() {
  const { default: Page } = await import('../UyThacDieuTraListPage');
  return render(
    <MemoryRouter initialEntries={['/uy-thac-dieu-tra']}>
      <Routes>
        <Route path="/uy-thac-dieu-tra" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UyThacDieuTraListPage — delete reason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes reason body in DELETE /cases/:id call', async () => {
    await renderPage();

    const row = await screen.findByText('PC02-UTDT-2026-00001', {}, { timeout: 10000 });
    expect(row).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('Xóa ủy thác');
    fireEvent.click(deleteBtn);

    await waitFor(
      () => {
        expect(mockApiDelete).toHaveBeenCalledWith(
          '/cases/utdt-list-001',
          expect.objectContaining({ data: expect.objectContaining({ reason: expect.any(String) }) }),
        );
      },
      { timeout: 5000 },
    );

    const callArgs = mockApiDelete.mock.calls[0];
    const reason: string = callArgs[1]?.data?.reason ?? '';
    expect(reason.length).toBeGreaterThanOrEqual(10);
  }, 20000);
});
