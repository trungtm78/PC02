/**
 * Re-reading the scans of a SAVED petition on its edit screen: the proposal is set beside the current values, using a
 * value only changes the open form, and nothing is saved until the officer presses Save.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

Element.prototype.scrollIntoView = vi.fn();

const apiGet = vi.fn();
const apiPut = vi.fn(() => Promise.resolve({ data: { success: true, data: { updatedAt: 'UA2' } } }));
vi.mock('@/lib/api', () => ({
  api: { get: apiGet, post: vi.fn(), put: apiPut },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: '2026-99999' }) },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));
vi.mock('@/features/ocr-import/useOcrAvailability', () => ({ useOcrAvailability: () => true }));

const ocr = vi.hoisted(() => ({
  startReread: vi.fn(),
  job: vi.fn(),
  analysis: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/features/ocr-import/ocrApi', () => ({ ocrApi: ocr }));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'ADMIN', canDispatch: true,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const HO_SO = {
  id: 'p1',
  stt: '2026-00123',
  receivedDate: '2026-10-05',
  senderName: 'Nguyen Thi Huong',
  senderPhone: '0901234567',
  detailContent: 'Nội dung',
  quyenGhi: true,
  updatedAt: 'UA1',
  status: 'PENDING',
};

const fill = (field: string, value: string) => ({
  field,
  value,
  policy: 'AI_FILL' as const,
  provenance: { claimKind: 'QUOTED', pageId: 'p1', quote: 'Tôi tên là Nguyễn Thị Hương' },
  warnings: [],
});

beforeEach(() => {
  sessionStorage.clear();
  apiGet.mockReset();
  apiGet.mockImplementation((url: string) =>
    typeof url === 'string' && url.includes('/petitions/p1')
      ? Promise.resolve({ data: { success: true, data: HO_SO } })
      : Promise.resolve({ data: { success: true, data: [] } }),
  );
  apiPut.mockClear();
  Object.values(ocr).forEach((fn) => fn.mockReset());
  ocr.startReread.mockResolvedValue({ sessionId: 's-re', jobId: 'j', pages: 2 });
  ocr.job.mockResolvedValue({
    id: 'j', kind: 'READ', state: 'SUCCEEDED', attempts: 1, lastErrorCode: null,
    createdAt: '2026-11-03T00:00:00Z', finishedAt: null,
  });
  ocr.analysis.mockResolvedValue({
    id: 'ana-1', entity: 'PETITION', pageSetRevision: 1, inputFingerprint: 'fp',
    cleaned: {}, issues: [], promptVersions: {},
    projection: {
      // layout names, as the server sends them
      fills: [fill('tenCungCap', 'Nguyễn Thị Hương'), fill('sdtCungCap', '0901234567')],
      skips: [],
    },
  });
  ocr.cancel.mockResolvedValue(undefined);
  authStore.setProfile(TOI);
});

async function renderEdit() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/p1/edit']}>
        <Routes>
          <Route path="/petitions/:id/edit" element={<PetitionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionFormPage — đọc lại từ ảnh scan (hồ sơ đã lưu)', () => {
  it('shows only the fields whose value differs, and using one changes the open form but saves nothing', async () => {
    await renderEdit();
    await waitFor(() =>
      expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Nguyen Thi Huong'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Đọc lại từ ảnh scan' }));
    const panel = await screen.findByTestId('ocr-reread', undefined, { timeout: 5000 });
    await waitFor(() => expect(within(panel).getByText('1 ô khớp với ảnh')).toBeTruthy(), { timeout: 5000 });
    expect(ocr.startReread).toHaveBeenCalledWith('PETITION', 'p1');
    // the phone matches; the name differs
    expect(within(panel).getByText('Nguyen Thi Huong')).toBeTruthy();
    expect(within(panel).getByText('Nguyễn Thị Hương')).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Dùng giá trị từ ảnh' }));
    await waitFor(() =>
      expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Nguyễn Thị Hương'),
    );
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('closing the comparison deletes the temporary session', async () => {
    await renderEdit();
    fireEvent.click(await screen.findByRole('button', { name: 'Đọc lại từ ảnh scan' }));
    await screen.findByText('1 ô khớp với ảnh', undefined, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng so sánh' }));
    await waitFor(() => expect(ocr.cancel).toHaveBeenCalledWith('s-re'));
  });
});
