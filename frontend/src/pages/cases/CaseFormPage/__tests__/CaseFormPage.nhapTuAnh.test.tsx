/**
 * Entering a case from scanned images, end to end on the create screen. The server side is faked; the page, the
 * hooks and the drawer are the real ones. Same guarantees as the Petition and Incident screens.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { INITIAL_FORM_DATA } from '../types';

// The real tabs fetch many directories of their own; the scan intake does not depend on them. The title input is all
// this test needs from the form body.
vi.mock('../tabs', () => {
  const Noop = () => null;
  const TabInfo = ({
    formData,
    setFormData,
  }: {
    formData: { caseTitle: string };
    setFormData: (fn: (p: { caseTitle: string }) => { caseTitle: string }) => void;
  }) => (
    <input
      data-testid="input-case-title"
      value={formData.caseTitle}
      onChange={(e) => setFormData((p) => ({ ...p, caseTitle: e.target.value }))}
    />
  );
  return {
    TabInfo, TabIncident: Noop, TabCase: Noop, TabSubjects: Noop, TabIncidentTDC: Noop, TabCaseTDC: Noop,
    TabEvidence: Noop, TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop,
  };
});
vi.mock('@/components/CrimeSelect', () => ({ CrimeSelect: ({ label }: { label: string }) => <div>{label}</div> }));
vi.mock('@/components/FKSelect', () => ({ FKSelect: ({ label }: { label: string }) => <div>{label}</div> }));
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.endsWith('/field-schema')) return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'case-new', updatedAt: 'UA1' } } })),
    put: vi.fn(),
    delete: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canCreate: () => true, canEdit: () => true }),
}));
vi.mock('@/hooks/useOfficerOptions', () => ({
  useOfficerOptions: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-2026-00001' }) },
}));
// The signed-in officer and today, as the form defaults know them.
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({
    isLoaded: true,
    today: '2026-11-03',
    userId: 'officer-1',
    primaryTeamName: 'Tổ 1',
    primaryTeamId: 'team-1',
  }),
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

const provenance = { claimKind: 'QUOTED', pageId: 'p1', quote: 'Tôi tên là Nguyễn Thị Hương' };
const analysis = {
  id: 'ana-1',
  entity: 'CASE',
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
  ocr.openSession.mockResolvedValue({ id: 'sess-7', entity: 'CASE' });
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
  localStorage.clear();
});

async function renderCreate() {
  const { default: CaseFormPage } = await import('../index');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/cases/new?caseProvenance=DIRECT_DISCOVERY']}>
        <Routes>
          <Route path="/cases/new" element={<CaseFormPage />} />
          <Route path="/cases" element={<div>list</div>} />
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

const createCalls = () => vi.mocked(api.post).mock.calls.filter(([path]) => path === '/cases');

describe('CaseFormPage — nhập từ ảnh scan', () => {
  it('reads the scans of a CASE session and fills the form; the risky field is listed in the bar', async () => {
    await renderCreate();
    await readOneScan();
    expect(ocr.openSession).toHaveBeenCalledWith('CASE');
    expect(screen.getByText('Đã điền 2 ô · 1 ô cần xác nhận')).toBeTruthy();
    expect(within(screen.getByTestId('ocr-fill-bar')).getAllByRole('button', { name: 'Xác nhận' })).toHaveLength(1);
    expect(createCalls()).toHaveLength(0); // filling never saves
  });

  it('blocks Save while a risky field is unconfirmed, then saves naming the session and the analysis', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.change(screen.getByTestId('input-case-title'), { target: { value: 'Vụ án lừa đảo qua mạng' } });

    await waitFor(() => expect(screen.getByTestId('btn-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByText(/ô lấy từ ảnh chưa xác nhận/)).toBeTruthy());
    expect(screen.queryByTestId('pre-save-summary-modal')).toBeNull();
    expect(createCalls()).toHaveLength(0);

    fireEvent.click(within(screen.getByTestId('ocr-fill-bar')).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(screen.getByTestId('btn-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('btn-save'));
    fireEvent.click(await screen.findByTestId('pre-save-confirm-btn'));
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][1]).toMatchObject({ ocrPhienId: 'sess-7', ocrPhienBan: 'ana-1' });
  });

  it('an ordinary save, with no scans read, does not mention a session', async () => {
    await renderCreate();
    fireEvent.change(await screen.findByTestId('input-case-title'), { target: { value: 'Vụ án thường' } });
    await waitFor(() => expect(screen.getByTestId('btn-save')).toBeEnabled());
    fireEvent.click(screen.getByTestId('btn-save'));
    fireEvent.click(await screen.findByTestId('pre-save-confirm-btn'));
    await waitFor(() => expect(createCalls()).toHaveLength(1));
    expect(createCalls()[0][1]).not.toHaveProperty('ocrPhienId');
  });

  it('a draft kept in the browser holds the text the officer typed and a reference to the scans, never what was read from them', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.change(screen.getByTestId('input-case-title'), { target: { value: 'Tiêu đề do cán bộ gõ' } });

    fireEvent.click(screen.getByTestId('btn-save-caret'));
    fireEvent.click(screen.getByTestId('btn-save-item-draft'));

    const raw = localStorage.getItem('caseFormDraft:regular');
    expect(raw).not.toBeNull();
    expect(raw).toContain('Tiêu đề do cán bộ gõ');
    expect(raw).not.toContain('Nguyễn Thị Hương');
    expect(raw).not.toContain('0901234567');
    expect(JSON.parse(raw as string).ocr).toEqual({ sessionId: 'sess-7', analysisId: 'ana-1' });
  });

  it('opening that draft later asks the server for the analysis again; the risky field waits for confirmation again', async () => {
    localStorage.setItem(
      'caseFormDraft:regular',
      JSON.stringify({
        version: 1,
        formData: { ...INITIAL_FORM_DATA, caseTitle: 'Tiêu đề do cán bộ gõ', caseProvenance: 'DIRECT_DISCOVERY' },
        parityState: {},
        metaState: {},
        subjects: [],
        evidences: [],
        ocr: { sessionId: 'sess-7', analysisId: 'ana-1' },
      }),
    );
    await renderCreate();
    await waitFor(() => expect(ocr.analysis).toHaveBeenCalledWith('sess-7'));
    expect(await screen.findByText('Đã điền 2 ô · 1 ô cần xác nhận')).toBeTruthy();
  });

  it('says so when the scans of a draft have expired', async () => {
    ocr.analysis.mockResolvedValue(null);
    localStorage.setItem(
      'caseFormDraft:regular',
      JSON.stringify({
        version: 1,
        formData: { ...INITIAL_FORM_DATA, caseTitle: 'Tiêu đề do cán bộ gõ', caseProvenance: 'DIRECT_DISCOVERY' },
        parityState: {},
        metaState: {},
        subjects: [],
        evidences: [],
        ocr: { sessionId: 'sess-gone', analysisId: 'ana-1' },
      }),
    );
    await renderCreate();
    expect(await screen.findByTestId('ocr-draft-unavailable')).toBeTruthy();
  });

  it('a draft holds none of the text read from the scans', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.click(screen.getByTestId('btn-save-caret'));
    fireEvent.click(screen.getByTestId('btn-save-item-draft'));
    expect(localStorage.getItem('caseFormDraft:regular')).not.toContain('Nguyễn Thị Hương');
  });

  it('undo takes the filled values out again', async () => {
    await renderCreate();
    await readOneScan();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác phần điền từ ảnh' }));
    await waitFor(() => expect(screen.queryByText(/Đã điền 2 ô/)).toBeNull());
  });
});
