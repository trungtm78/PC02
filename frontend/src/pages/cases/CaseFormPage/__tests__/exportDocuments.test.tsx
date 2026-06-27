import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Stub modal động để khỏi gọi listTemplates thật — chỉ kiểm tra wiring mở/đóng.
vi.mock('@/features/document-templates/components/DynamicExportDocumentsModal', () => ({
  DynamicExportDocumentsModal: ({ entity, entityId }: { entity: string; entityId: string }) => (
    <div data-testid="dynamic-export-modal-stub">
      {entity}:{entityId}
    </div>
  ),
}));

// Stub các tab (chứa nhiều child tự fetch — ProvinceWardSelect, FKSelect...) — test này
// chỉ kiểm tra wiring nút/modal ở header, không cần nội dung tab.
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
      if (url.startsWith('/cases/')) {
        return Promise.resolve({ data: { data: { name: 'Vụ án test', caseProvenance: 'DIRECT_DISCOVERY', updatedAt: '2026-06-27T00:00:00Z', metadata: {} } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'case-new' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-2026-00001' }) },
}));

beforeEach(() => {
  vi.mocked(api.get).mockClear();
});

async function renderEdit() {
  const { default: CaseFormPage } = await import('../index');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/cases/case-1/edit']}>
        <Routes>
          <Route path="/cases/:id/edit" element={<CaseFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CaseFormPage — xuất chứng từ động (PR3)', () => {
  it('edit mode: hiện nút "In chứng từ" và mở modal động VU_AN với id', async () => {
    await renderEdit();
    const btn = await screen.findByTestId('btn-print-docs');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    const modal = await screen.findByTestId('dynamic-export-modal-stub');
    expect(modal).toHaveTextContent('cases:case-1');
  });

  it('có split-button Lưu hồ sơ với tuỳ chọn "Lưu và xuất file"', async () => {
    await renderEdit();
    expect(await screen.findByTestId('btn-save')).toHaveTextContent('Lưu hồ sơ');
    fireEvent.click(screen.getByTestId('btn-save-caret'));
    expect(screen.getByTestId('btn-save-item-export')).toBeInTheDocument();
  });
});
