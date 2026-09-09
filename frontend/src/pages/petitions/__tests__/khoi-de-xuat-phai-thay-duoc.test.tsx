import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

/**
 * Khối "Nội dung phiếu đề xuất" phải THẤY ĐƯỢC ngay khi mở form.
 *
 * ── Lỗi thật, anh báo 09/09/2026 ──
 *
 * Khối này từng nằm ở `children` của `LegacyTabBody`, mà component ấy bọc children trong một
 * thẻ `<details>` nhan đề "Bổ sung hệ mới" và KHÔNG mở sẵn. Kết quả: ô "Hướng xử lý", ô "Đơn vị
 * xử lý" và nút tạo nhanh đơn vị đều bị gập lại — cán bộ không thấy, dù mã đã lên máy thật.
 *
 * Vì sao ca kiểm cũ không bắt được: nội dung của `<details>` đóng VẪN nằm trong DOM, nên
 * `findByTestId` tìm thấy bình thường và mọi ca kiểm đều xanh trong khi giao diện không dùng
 * được. Ca kiểm ở đây soi QUAN HỆ CHA-CON chứ không soi sự tồn tại.
 */
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 't' }),
  },
}));

const NGUOI_DUNG: AuthUser = {
  id: 'u1', email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 't1', teamName: 'Đội 1' },
};

async function moForm() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Có tổ tiên nào là `<details>` đang ĐÓNG không — tức người dùng phải bấm mới thấy. */
function biGapLai(el: HTMLElement | null): boolean {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    if (n.tagName === 'DETAILS' && !(n as HTMLDetailsElement).open) return true;
  }
  return false;
}

describe('khối "Nội dung phiếu đề xuất" phải thấy được ngay', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); authStore.setProfile(NGUOI_DUNG); });
  afterEach(() => { vi.clearAllMocks(); });

  it.each([
    ['section-noi-dung-phieu-de-xuat', 'cả khối'],
    ['field-huongXuLy-GIAO_DON', 'ô Hướng xử lý'],
    ['field-donViXuLy', 'ô Đơn vị xử lý'],
    ['field-deXuat', 'ô Đề xuất'],
  ])('%s (%s) không bị gập trong thẻ đóng', async (testId) => {
    await moForm();
    const el = await screen.findByTestId(testId);
    expect(biGapLai(el)).toBe(false);
  });

  it('không nằm dưới nhãn "Bổ sung hệ mới"', async () => {
    await moForm();
    const khoi = await screen.findByTestId('section-noi-dung-phieu-de-xuat');
    await waitFor(() => expect(khoi).toBeTruthy());
    const goi = document.querySelector('[data-testid^="bo-sung-he-moi-"]');
    expect(goi?.contains(khoi) ?? false).toBe(false);
  });
});
