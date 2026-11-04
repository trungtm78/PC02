/**
 * Entering an incident from scanned images, end to end on the create screen. The server side is faked; the page, the
 * hooks and the drawer are the real ones. Mirrors the Petition test: the same guarantees, on the Incident form.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn((path: string) =>
      path === '/incidents/duplicate-review'
        ? Promise.resolve({ data: [] })
        : Promise.resolve({ data: { success: true, data: { id: 'inc-new', updatedAt: 'UA1' } } }),
    ),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canCreate: () => true }) }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useFormDefaults', () => ({ useFormDefaults: () => ({ isLoaded: false }) }));
vi.mock('@/hooks/useCatalog', () => ({ useCatalog: () => ({ options: [] }) }));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn(() => new Promise(() => {})) },
}));

const ocr = vi.hoisted(() => ({
  openSession: vi.fn(),
  uploadPage: vi.fn(),
  read: vi.fn(),
  job: vi.fn(),
  analysis: vi.fn(),
  cancel: vi.fn(() => Promise.resolve()),
  reorder: vi.fn(),
  removePage: vi.fn(),
}));
vi.mock('@/features/ocr-import/ocrApi', () => ({ ocrApi: ocr }));
vi.mock('@/features/ocr-import/useOcrAvailability', () => ({ useOcrAvailability: () => true }));

const provenance = { claimKind: 'QUOTED', pageId: 'p1', quote: 'Tôi tên là Nguyễn Thị Hương' };
const analysis = {
  id: 'ana-1',
  entity: 'INCIDENT',
  pageSetRevision: 1,
  inputFingerprint: 'fp',
  cleaned: { summary: 'Bà Hương tố cáo ông Bình lừa đảo.' },
  issues: [],
  promptVersions: {},
  projection: {
    fills: [
      { field: 'tenCungCap', value: 'Nguyễn Thị Hương', policy: 'AI_FILL_MUST_CONFIRM', provenance, warnings: [] },
      { field: 'sdtCungCap', value: '0901234567', policy: 'AI_FILL', provenance, warnings: [] },
    ],
    skips: [],
  },
};

beforeEach(() => {
  vi.mocked(api.post).mockClear();
  Object.values(ocr).forEach((fn) => fn.mockReset());
  ocr.openSession.mockResolvedValue({ id: 'sess-9', entity: 'INCIDENT' });
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
  const { IncidentFormPage } = await import('../IncidentFormPage');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/vu-viec/new']}>
        <Routes>
          <Route path="/vu-viec/new" element={<IncidentFormPage />} />
          <Route path="/vu-viec" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function readOneScan() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nhập từ ảnh scan' }));
  const input = await screen.findByTestId('ocr-file-input');
  fireEvent.change(input, { target: { files: [new File(['x'], 'don.jpg', { type: 'image/jpeg' })] } });
  await screen.findByText('Trang 1');
  fireEvent.click(screen.getByRole('button', { name: 'Đọc và điền vào form' }));
  await screen.findByText(/Đã điền vào form/, undefined, { timeout: 5000 });
}

const createCalls = () =>
  vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents');

describe('IncidentFormPage — nhập từ ảnh scan', () => {
  it('reads the scans of an INCIDENT session and fills the form, with nothing left to confirm', async () => {
    await renderCreate();
    await readOneScan();
    expect(ocr.openSession).toHaveBeenCalledWith('INCIDENT');
    expect(screen.getByText('Đã điền 2 ô từ ảnh')).toBeTruthy();
    // the sender's name really landed in a field of this form, under whatever name the form keeps it
    expect(screen.getAllByDisplayValue('Nguyễn Thị Hương').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('ocr-fill-bar')).queryByRole('button', { name: 'Xác nhận' })).toBeNull();
    // filling never saves
    expect(createCalls()).toHaveLength(0);
  });

  it('saves straight after the fill, naming the session and the analysis', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Vụ việc lừa đảo qua mạng' } });

    fireEvent.click(screen.getByTestId('btn-save-top'));
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][1]).toMatchObject({ ocrPhienId: 'sess-9', ocrPhienBan: 'ana-1' });
    expect(screen.queryByText(/chưa xác nhận/)).toBeNull();
  });

  it('an ordinary save, with no scans read, does not mention a session', async () => {
    await renderCreate();
    fireEvent.change(await screen.findByTestId('field-name'), { target: { value: 'Vụ việc thường' } });
    fireEvent.click(screen.getByTestId('btn-save-top'));
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][1]).not.toHaveProperty('ocrPhienId');
  });

  it('undo takes the filled values out again', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác phần điền từ ảnh' }));
    await waitFor(() => expect(screen.queryByText(/Đã điền 2 ô/)).toBeNull());
  });
});
