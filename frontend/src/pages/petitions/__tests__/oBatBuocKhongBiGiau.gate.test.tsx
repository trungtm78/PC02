import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

Element.prototype.scrollIntoView = vi.fn();

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-1', isDraft: true, templateId: 't' }),
  },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const NGUON = [
  { id: 'n1', name: 'Bưu điện', code: 'ND0001' },
  { id: 'n2', name: 'Trực tiếp', code: 'ND0002' },
];

async function moForm() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes><Route path="/petitions/new" element={<PetitionFormPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * CỔNG: bấm Lưu mà bị chặn thì ô gây ra việc chặn PHẢI nhìn thấy được.
 *
 * Đây là lỗi PR #248 và là lý do cơ chế `pinnedTop` ra đời: ô bắt buộc nằm trong khối gập
 * đóng sẵn → cán bộ điền xong tab, bấm Lưu, nhận thông báo cho một ô KHÔNG nhìn thấy, và
 * không có cách nào biết phải mở cái gì ra.
 *
 * ĐỔI 20/09/2026 — đọc kỹ trước khi thêm ca vào đây.
 *
 * Theo yêu cầu của anh, "Số điện thoại nguyên đơn" đã RA KHỎI nhóm định danh. Hệ quả: nhóm ấy
 * còn bốn ô mà `validate.ts` KHÔNG có luật nào nhắm tới, nên trên form thật **nhóm không bao giờ
 * đỏ được**. Ba ca cũ dựng trên trạng thái lỗi của nhóm ("đóng tay rồi bấm Lưu", "nhóm đang lỗi
 * không đóng được", "tiêu đề hiện trạng thái lỗi") vì thế không còn DIỄN được nữa — giữ lại thì
 * chúng xanh rỗng: đúng mà chẳng khẳng định gì, và đó là kiểu cổng tệ nhất.
 *
 * Phần chúng từng bảo vệ nay nằm ở hai chỗ, mỗi chỗ CÒN khẳng định được thật:
 *  · Cấu trúc — `features/petitions/__tests__/oBatBuocKhongTrongNhom.gate.test.ts`: không ô
 *    `required` nào được nằm trong bất kỳ nhóm nào. Đỏ ngay nếu ai đưa SĐT trở lại.
 *  · Hành vi — `components/legacy-form/__tests__/nhomOGap.test.tsx`: tự bung khi có lỗi, và
 *    nhóm đang lỗi thì không đóng lại được. Ở đó dựng được một ô lỗi tuỳ ý.
 */
describe('CỔNG: không chặn Lưu bằng ô nằm trong nhóm đang đóng', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) =>
      typeof duong === 'string' && duong.startsWith('/directories')
        ? Promise.resolve({ data: { data: NGUON } })
        : Promise.resolve({ data: { success: true, data: [] } }),
    );
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  /**
   * Mệnh đề QUAN TRỌNG NHẤT nay là: ô chặn Lưu KHÔNG nằm trong một khối có thể đóng.
   *
   * Mạnh hơn "nhìn thấy được": một ô đang nhìn thấy vì nhóm vô tình đang mở thì lần sau cán bộ
   * đóng nhóm lại là hỏng. Ở đây khẳng định thẳng vào cấu trúc — SĐT không phải con của bất kỳ
   * thẻ nhóm nào — nên đưa nó trở vào nhóm là ca này ĐỎ, dù nhóm có đang mở hay không.
   */
  it('ô chặn Lưu KHÔNG nằm trong bất kỳ nhóm gập nào', async () => {
    const { container } = await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    const o = await waitFor(() => screen.getByTestId('field-senderPhone'));
    const moiNhom = Array.from(
      container.querySelectorAll('[data-testid^="nhom-"]'),
    ).filter((e) => !(e.getAttribute('data-testid') ?? '').endsWith('-nut'));
    expect(moiNhom.length, 'không có nhóm nào — cổng chạy trên tập rỗng').toBeGreaterThan(0);

    const trongNhom = moiNhom.filter((n) => n.contains(o)).map((n) => n.getAttribute('data-testid'));
    expect(
      trongNhom,
      'ô chặn Lưu nằm trong khối gập thì có lúc cán bộ bị chặn bởi ô không nhìn thấy (PR #248)',
    ).toEqual([]);
  });

  it('CHƯA bấm Lưu thì KHÔNG mắng trước — chọn Trực tiếp không làm nhóm đỏ ngay', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));
    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don').className).not.toContain('border-red');
  });

  it('Nguồn đơn = Trực tiếp + bấm Lưu khi thiếu SĐT → ô SĐT phải NHÌN THẤY được', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    // Nếu nhóm còn đóng ở đây thì cán bộ bị chặn bởi một ô không nhìn thấy — đúng lỗi #248.
    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());
  });

});
