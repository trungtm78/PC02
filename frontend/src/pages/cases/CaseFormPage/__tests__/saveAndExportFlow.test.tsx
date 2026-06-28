/**
 * Repro luồng THẬT "Lưu và xuất file" (edit mode) — dùng DynamicExportDocumentsModal THẬT
 * (không stub) để bắt bug end-to-end: save (PUT) → mở modal → fetch mẫu → chọn → Xuất file
 * → exportEntityDocuments + triggerDownload. Tái hiện báo cáo "không xuất được".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as exportApi from '@/features/document-templates/export.api';

// Stub các tab (child tự fetch) để tránh crash — KHÔNG stub modal.
vi.mock('../tabs', () => {
  const Noop = () => null;
  return {
    TabInfo: Noop, TabIncident: Noop, TabCase: Noop, TabSubjects: Noop,
    TabIncidentTDC: Noop, TabCaseTDC: Noop, TabEvidence: Noop,
    TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop,
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('/export-readiness')) {
        // Mẫu 't1' đủ thông tin → ready (modal cho tick + xuất).
        return Promise.resolve({ data: { data: { updatedAt: '2026-06-28T00:00:00Z', items: [{ templateId: 't1', ready: true, missing: [] }] } } });
      }
      if (url.startsWith('/cases/')) {
        // Data ĐỦ: name→caseTitle, investigatorId→handler, metadata.receiveDate (quá khứ), caseProvenance.
        return Promise.resolve({ data: { data: { name: 'Vụ án test', caseProvenance: 'DIRECT_DISCOVERY', investigatorId: 'u1', updatedAt: '2026-06-28T00:00:00Z', metadata: { receiveDate: '2026-06-01' } } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'case-1' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-2026-00001' }) },
}));

// Mock LỚP MẠNG của export.api (giữ component thật): list trả 1 mẫu, export trả blob.
const mList = vi.spyOn(exportApi, 'listExportTemplates');
const mExport = vi.spyOn(exportApi, 'exportEntityDocuments');
const mDownload = vi.spyOn(exportApi, 'triggerDownload');

beforeEach(() => {
  vi.mocked(api.get).mockClear();
  vi.mocked(api.put).mockClear();
  mList.mockResolvedValue([
    { id: 't1', code: 'QD01', name: 'Quyết định khởi tố', entityType: 'VU_AN', category: 'Quyết định', fileName: 'a.docx', fileSha: 's', variables: [], needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0 },
  ]);
  mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
  mDownload.mockImplementation(() => {});
});

async function renderEdit() {
  const { default: CaseFormPage } = await import('../index');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/cases/case-1/edit']}>
        <Routes>
          <Route path="/cases/:id/edit" element={<CaseFormPage />} />
          <Route path="/cases" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CaseFormPage — luồng "Lưu và xuất file" end-to-end (repro)', () => {
  it('▼ Lưu và xuất file → PUT → modal mẫu thật → Xuất file → export + download', async () => {
    await renderEdit();
    // mở menu split-button → "Lưu và xuất file"
    fireEvent.click(await screen.findByTestId('btn-save-caret'));
    fireEvent.click(screen.getByTestId('btn-save-item-export'));
    // save (edit mode → PUT, không qua PreSaveSummary)
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    // modal THẬT mở + fetch mẫu theo entity=cases
    await waitFor(() => expect(mList).toHaveBeenCalledWith('cases'));
    expect(await screen.findByTestId('dynamic-export-modal')).toBeInTheDocument();
    // mẫu hiển thị, tick sẵn
    const cb = await screen.findByTestId('dyn-export-checkbox-t1') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    // bấm Xuất file
    fireEvent.click(screen.getByTestId('dyn-export-confirm'));
    await waitFor(() =>
      expect(mExport).toHaveBeenCalledWith('cases', 'case-1', expect.objectContaining({ templateIds: ['t1'], mode: 'merged' })),
    );
    await waitFor(() => expect(mDownload).toHaveBeenCalled());
  });

  it('nút "In chứng từ" độc lập (edit) → modal mẫu thật → Xuất file', async () => {
    await renderEdit();
    fireEvent.click(await screen.findByTestId('btn-print-docs'));
    await waitFor(() => expect(mList).toHaveBeenCalledWith('cases'));
    fireEvent.click(await screen.findByTestId('dyn-export-confirm'));
    await waitFor(() => expect(mExport).toHaveBeenCalled());
  });
});
