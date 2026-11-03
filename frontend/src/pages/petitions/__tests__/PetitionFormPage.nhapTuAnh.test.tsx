/**
 * Entering a petition from scanned images, end to end on the create screen: pick pages, read, the form is filled,
 * risky fields wait for the officer, Save is blocked until they confirm, and the saved request names the scan session.
 * The server side is faked; the page, the hooks and the drawer are the real ones.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn((url: string) => {
      if (url === '/petitions') {
        return Promise.resolve({ data: { success: true, data: { id: 'new-pet', updatedAt: 'UA1' } } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    put: vi.fn(() => Promise.resolve({ data: { success: true, data: { updatedAt: 'UA2' } } })),
  },
  authApi: { me: vi.fn() },
}));

const ocr = vi.hoisted(() => ({
  openSession: vi.fn(),
  uploadPage: vi.fn(),
  read: vi.fn(),
  job: vi.fn(),
  analysis: vi.fn(),
  cancel: vi.fn(),
  reorder: vi.fn(),
  removePage: vi.fn(),
}));
vi.mock('@/features/ocr-import/ocrApi', () => ({ ocrApi: ocr }));
vi.mock('@/features/ocr-import/useOcrAvailability', () => ({ useOcrAvailability: () => true }));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001' }) },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }] }),
}));
vi.mock('./PetitionAssignmentSection', () => ({ PetitionAssignmentSection: () => null }));
vi.mock('@/components/FKSelect', () => ({ FKSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} /> }));
vi.mock('@/components/CrimeSelect', () => ({ CrimeSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} /> }));

const provenance = { claimKind: 'QUOTED', pageId: 'p1', quote: 'Tôi tên là Nguyễn Thị Hương' };
const analysis = {
  id: 'ana-1',
  entity: 'PETITION',
  pageSetRevision: 1,
  inputFingerprint: 'fp',
  cleaned: { summary: 'Bà Hương tố cáo ông Bình lừa đảo.' },
  issues: [],
  promptVersions: {},
  projection: {
    fills: [
      { field: 'senderName', value: 'Nguyễn Thị Hương', policy: 'AI_FILL_MUST_CONFIRM', provenance, warnings: [] },
      { field: 'senderPhone', value: '0901234567', policy: 'AI_FILL', provenance, warnings: [] },
    ],
    skips: [],
  },
};

beforeEach(() => {
  navigateMock.mockClear();
  vi.mocked(api.post).mockClear();
  Object.values(ocr).forEach((fn) => fn.mockReset());
  ocr.openSession.mockResolvedValue({ id: 'sess-1', entity: 'PETITION' });
  ocr.uploadPage.mockResolvedValue({
    page: { id: 'p1', sha256: 'p1', mimeType: 'image/jpeg', sizeBytes: 3, createdAt: '2026-11-03T00:00:00Z' },
    pageSetRevision: 1,
  });
  ocr.read.mockResolvedValue({ id: 'j1', deduplicated: false });
  ocr.job.mockResolvedValue({
    id: 'j1', kind: 'READ', state: 'SUCCEEDED', attempts: 1, lastErrorCode: null,
    createdAt: '2026-11-03T00:00:00Z', finishedAt: null,
  });
  ocr.analysis.mockResolvedValue(analysis);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

async function renderCreate() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Opens the drawer, picks one scan and reads it. */
async function readOneScan() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nhập từ ảnh scan' }));
  const input = await screen.findByTestId('ocr-file-input');
  fireEvent.change(input, { target: { files: [new File(['x'], 'don.jpg', { type: 'image/jpeg' })] } });
  await screen.findByText('Trang 1');
  fireEvent.click(screen.getByRole('button', { name: 'Đọc và điền vào form' }));
  await screen.findByText(/Đã điền vào form/, undefined, { timeout: 5000 });
}

describe('PetitionFormPage — nhập từ ảnh scan', () => {
  it('fills the form from the reading and shows where each value came from', async () => {
    await renderCreate();
    await readOneScan();

    expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Nguyễn Thị Hương');
    expect((screen.getByTestId('field-senderPhone') as HTMLInputElement).value.replaceAll(' ', '')).toBe('0901234567');
    expect(screen.getByTestId('ocr-note-senderName')).toBeTruthy();
    expect(screen.getByText('Đã điền 2 ô · 1 ô cần xác nhận')).toBeTruthy();
    // nothing was saved by filling
    expect(vi.mocked(api.post).mock.calls.filter(([u]) => u === '/petitions')).toHaveLength(0);
  });

  it('blocks Save while a risky field is unconfirmed, then saves with the session once confirmed', async () => {
    await renderCreate();
    // An anonymous petition needs no sender address or offence; the point here is the scan confirmation.
    fireEvent.click(await screen.findByTestId('field-senderIsAnonymous'));
    await readOneScan();
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'chi tiết' } });

    fireEvent.click(screen.getByTestId('btn-save-top-main'));
    await waitFor(() => expect(screen.getByText(/ô lấy từ ảnh chưa xác nhận/)).toBeTruthy());
    expect(vi.mocked(api.post).mock.calls.filter(([u]) => u === '/petitions')).toHaveLength(0);

    const bar = screen.getByTestId('ocr-fill-bar');
    fireEvent.click(within(bar).getByRole('button', { name: 'Xác nhận' }));
    fireEvent.click(screen.getByTestId('btn-save-top-main'));

    await waitFor(() => {
      const calls = vi.mocked(api.post).mock.calls.filter(([u]) => u === '/petitions');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({ ocrPhienId: 'sess-1', ocrPhienBan: 'ana-1' });
    });
  });

  it('an ordinary save, with no scans read, does not mention a session', async () => {
    await renderCreate();
    fireEvent.click(await screen.findByTestId('field-senderIsAnonymous'));
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'chi tiết' } });
    fireEvent.click(screen.getByTestId('btn-save-top-main'));
    await waitFor(() => {
      const calls = vi.mocked(api.post).mock.calls.filter(([u]) => u === '/petitions');
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).not.toHaveProperty('ocrPhienId');
    });
  });

  it('undo takes the filled values out again', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác phần điền từ ảnh' }));
    await waitFor(() =>
      expect((screen.getByTestId('field-senderPhone') as HTMLInputElement).value).toBe(''),
    );
  });
});
