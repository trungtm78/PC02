/**
 * Nút "In chứng từ" độc lập trên chi tiết đơn thư (edit mode).
 * Mở DynamicExportDocumentsModal (engine ĐỘNG) KHÔNG cần lưu lại; đóng popup → ở lại form
 * (KHÔNG điều hướng về danh sách như nhánh "Lưu và xuất file").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (/^\/petitions\/[^/]+$/.test(url)) {
        return Promise.resolve({ data: { success: true, data: { id: 'pet-1', senderName: 'A', updatedAt: '2026-06-27T00:00:00Z' } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001' }) },
}));

// Stub modal xuất chứng từ ĐỘNG (PR3) — kiểm tra wiring mở/đóng, không cần fetch mẫu/blob.
vi.mock('@/features/document-templates/components/DynamicExportDocumentsModal', () => ({
  DynamicExportDocumentsModal: ({ entity, entityId, onClose }: { entity: string; entityId: string; onClose: () => void }) => (
    <div data-testid="export-documents-modal">
      <span>{entity}:{entityId}</span>
      <button data-testid="stub-close" onClick={onClose}>x</button>
    </div>
  ),
}));

// Stub child nặng (tự fetch) để render edit mode không crash.
vi.mock('./PetitionAssignmentSection', () => ({
  PetitionAssignmentSection: () => <div data-testid="assignment-stub" />,
}));
vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));
vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));

beforeEach(() => {
  vi.mocked(api.get).mockClear();
});

async function renderEdit() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/petitions/pet-1/edit']}>
        <Routes>
          <Route path="/petitions/:id/edit" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionFormPage — nút "In chứng từ" độc lập (PR4)', () => {
  it('edit mode: mở modal xuất chứng từ; đóng → ở lại form (KHÔNG về danh sách)', async () => {
    await renderEdit();
    const btn = await screen.findByTestId('btn-print-docs');
    fireEvent.click(btn);
    const modal = await screen.findByTestId('export-documents-modal');
    expect(modal).toHaveTextContent('petitions:pet-1');
    // KHÔNG gọi lưu khi chỉ In chứng từ.
    expect(api.post).not.toHaveBeenCalled();
    // Đóng popup → không điều hướng (route /petitions render "list").
    fireEvent.click(screen.getByTestId('stub-close'));
    expect(screen.queryByText('list')).not.toBeInTheDocument();
  });
});
