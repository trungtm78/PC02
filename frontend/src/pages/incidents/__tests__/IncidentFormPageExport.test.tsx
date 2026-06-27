import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Stub modal động — chỉ kiểm tra wiring mở/đóng ở form.
vi.mock('@/features/document-templates/components/DynamicExportDocumentsModal', () => ({
  DynamicExportDocumentsModal: ({ entity, entityId }: { entity: string; entityId: string }) => (
    <div data-testid="dynamic-export-modal-stub">
      {entity}:{entityId}
    </div>
  ),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.startsWith('/incidents/')) {
        return Promise.resolve({ data: { success: true, data: { name: 'Vụ việc test', updatedAt: '2026-06-27T00:00:00Z' } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'inc-new' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'VV-2026-00001' }) },
}));

beforeEach(() => {
  vi.mocked(api.get).mockClear();
});

async function renderEdit() {
  const { IncidentFormPage } = await import('../IncidentFormPage');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/vu-viec/inc-1/edit']}>
        <Routes>
          <Route path="/vu-viec/:id/edit" element={<IncidentFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('IncidentFormPage — xuất chứng từ động (PR3)', () => {
  it('edit mode: nút "In chứng từ" mở modal động VU_VIEC với id', async () => {
    await renderEdit();
    const btn = await screen.findByTestId('btn-print-docs');
    fireEvent.click(btn);
    expect(await screen.findByTestId('dynamic-export-modal-stub')).toHaveTextContent('incidents:inc-1');
  });

  it('split-button top có tuỳ chọn "Lưu và xuất file"', async () => {
    await renderEdit();
    fireEvent.click(await screen.findByTestId('btn-save-top-caret'));
    expect(screen.getByTestId('btn-save-top-item-export')).toBeInTheDocument();
  });
});
