/**
 * Regression PR1 — fix "không lưu được đơn thư" (409 optimistic-lock).
 *
 * Repro LIVE local đã chốt cơ chế: PUT#1 (đúng updatedAt) → 200 (bump updatedAt mới);
 * PUT#2 (gửi LẠI updatedAt cũ — FE không refresh) → P2025 → 409 "đã được chỉnh sửa bởi
 * người dùng khác"; PUT#3 (updatedAt mới từ response) → 200.
 *
 * Test này khoá fix: sau "Lưu và xuất file" (ở lại form), lần lưu KẾ TIẾP phải gửi
 * `expectedUpdatedAt` = updatedAt MỚI từ response (NEW-UA), không phải giá trị cũ (OLD-UA).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

// navigate no-op → đóng popup "Lưu và xuất file" không unmount form (giữ form để lưu lần 2).
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const putBodies: Array<{ expectedUpdatedAt?: string }> = [];
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (/^\/petitions\/[^/]+$/.test(url)) {
        // Đơn nặc danh + đủ field bắt buộc → validateForm pass; updatedAt khởi đầu = OLD-UA.
        return Promise.resolve({ data: { success: true, data: {
          id: 'pet-1', senderIsAnonymous: true, receivedDate: '2026-06-01',
          petitionType: 'TO_CAO', summary: 'x', detailContent: 'y', updatedAt: 'OLD-UA',
        } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn((_url: string, body: { expectedUpdatedAt?: string }) => {
      putBodies.push(body);
      return Promise.resolve({ data: { success: true, data: { updatedAt: 'NEW-UA' } } });
    }),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001' }) },
}));
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
  putBodies.length = 0;
  navigateMock.mockClear();
  vi.mocked(api.put).mockClear();
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

describe('PetitionFormPage — regression 409 optimistic-lock (PR1)', () => {
  it('lưu 2 lần liên tiếp: lần 2 gửi updatedAt MỚI từ response (không 409)', async () => {
    await renderEdit();
    // nút "Cập nhật" (onSave → navigate no-op nên form ở lại sau khi lưu)
    const luu = await screen.findByTestId('btn-save-top-main');

    // Lần 1: PUT#1 dùng OLD-UA (giá trị load ban đầu)
    fireEvent.click(luu);
    await waitFor(() => expect(putBodies.length).toBe(1));
    expect(putBodies[0].expectedUpdatedAt).toBe('OLD-UA');
    // đã lưu thành công → navigate no-op (mock) → form vẫn còn
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/petitions'));

    // Lần 2: PUT#2 phải dùng NEW-UA (đã refresh từ response), KHÔNG phải OLD-UA cũ → tránh 409
    fireEvent.click(screen.getByTestId('btn-save-top-main'));
    await waitFor(() => expect(putBodies.length).toBe(2));
    expect(putBodies[1].expectedUpdatedAt).toBe('NEW-UA');
  });
});
