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
 * Gom nhóm làm lớp lỗi này sống lại, nên phải có cổng riêng — cổng này bắt cả ô bắt buộc
 * thêm vào nhóm về sau, không riêng ô đang có.
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
   * Mệnh đề QUAN TRỌNG NHẤT: đi qua đúng trạng thái nguy hiểm.
   *
   * Bản đầu của cổng chỉ chọn Trực tiếp rồi bấm Lưu — mà `moKhi` đã mở nhóm ngay từ bước
   * chọn, nên cổng không bao giờ chạm tới đường `coLoi` và vẫn xanh kể cả khi gỡ sạch đường
   * ấy đi. Ở đây ĐÓNG NHÓM BẰNG TAY trước, rồi mới bấm Lưu.
   */
  it('đóng nhóm bằng TAY rồi bấm Lưu → ô gây chặn vẫn phải NHÌN THẤY được', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));
    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());

    // Cán bộ mở ra xem rồi đóng lại — thao tác hoàn toàn bình thường.
    fireEvent.click(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut'));
    expect(screen.queryByTestId('field-senderPhone')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());
  });

  it('nhóm đang chặn Lưu thì KHÔNG đóng lại được — đóng là giấu thứ đang chặn', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut'));
    expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument();
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

  it('nhóm có ô báo lỗi thì tiêu đề nhóm hiện trạng thái lỗi', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Trực tiếp'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    await waitFor(() =>
      expect(screen.getByTestId('nhom-dinh-danh-nguyen-don').className).toContain('border-red'),
    );
  });
});
