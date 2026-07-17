/**
 * PR2 — integration: TẠO MỚI đơn thư có ĐÍNH FILE → sau khi Lưu (POST /petitions tạo id),
 * form tự upload file đã stage vào đơn vừa tạo (POST /documents với petitionId mới).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const docPosts: Array<{ petitionId: string | null; name: string | null }> = [];
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn((url: string, body: unknown) => {
      if (url === '/petitions') {
        return Promise.resolve({ data: { success: true, data: { id: 'new-pet', updatedAt: 'UA1' } } });
      }
      if (url === '/documents') {
        const fd = body as FormData;
        const file = fd.get('file') as File | null;
        docPosts.push({ petitionId: fd.get('petitionId') as string | null, name: file?.name ?? null });
        return Promise.resolve({ data: { success: true, data: { id: 'doc-1' } } });
      }
      return Promise.resolve({ data: { success: true, data: {} } });
    }),
    put: vi.fn(() => Promise.resolve({ data: { success: true, data: { updatedAt: 'UA2' } } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001' }) },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }] }),
}));
vi.mock('./PetitionAssignmentSection', () => ({ PetitionAssignmentSection: () => null }));
vi.mock('@/components/FKSelect', () => ({ FKSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} /> }));
vi.mock('@/components/CrimeSelect', () => ({ CrimeSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} /> }));

beforeEach(() => {
  docPosts.length = 0;
  navigateMock.mockClear();
  vi.mocked(api.post).mockClear();
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

describe('PetitionFormPage — tạo mới có đính file (PR2)', () => {
  it('stage file ở create → Lưu → POST /documents với petitionId mới', async () => {
    await renderCreate();
    // đơn nặc danh để bỏ qua field người gửi/SĐT/tội danh
    fireEvent.click(await screen.findByTestId('field-senderIsAnonymous'));
    fireEvent.change(screen.getByTestId('field-petitionType'), { target: { value: 'TO_CAO' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'chi tiết' } });

    // stage 1 file
    const input = screen.getByTestId('stage-file-input') as HTMLInputElement;
    const file = new File(['x'], 'bằng-chứng.pdf', { type: 'application/pdf' });
    fireEvent(input, createEvent.change(input, { target: { files: [file] } }));
    await screen.findByText('bằng-chứng.pdf');

    // Lưu
    fireEvent.click(screen.getByTestId('btn-save-top-main'));

    // POST /petitions tạo id mới → upload file vào id đó
    await waitFor(() => expect(docPosts.length).toBe(1));
    expect(docPosts[0]).toEqual({ petitionId: 'new-pet', name: 'bằng-chứng.pdf' });
    // upload ok → điều hướng về danh sách
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/petitions'));
  });
});
