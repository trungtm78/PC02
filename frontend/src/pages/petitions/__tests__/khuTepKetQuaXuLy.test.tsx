import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { DungLaiTheoId } from '@/lib/features/dungLaiTheoId';
import { LOAI_TEP_KET_QUA } from '@/features/petitions/loai-tep.def';

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
    draft: vi.fn().mockResolvedValue({ previewNumber: '2026-1', isDraft: true, templateId: 't' }),
  },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'ADMIN', canDispatch: true,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const HO_SO = {
  id: 'p1', stt: '2026-1', senderName: 'Nguyễn Văn A',
  detailContent: 'Nội dung', ketQuaXuLyKhac: 'Đã chuyển Công an phường', status: 'PENDING',
};

async function mo(duong: string) {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[duong]}>
        <Routes>
          <Route path="/petitions/:id/edit" element={<DungLaiTheoId><PetitionFormPage /></DungLaiTheoId>} />
          <Route path="/petitions/new" element={<DungLaiTheoId><PetitionFormPage /></DungLaiTheoId>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Anh yêu cầu 22/09/2026: khu tải tệp NGAY CẠNH ô "Kết quả xử lý, giải quyết khác", cho tệp
 * NHẬN VỀ từ các đơn vị xử lý — ở CẢ màn đăng ký mới lẫn màn cập nhật.
 */
describe('Khu tệp "Kết quả xử lý" cạnh ô kết quả', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) =>
      typeof duong === 'string' && duong.includes('/petitions/p1')
        ? Promise.resolve({ data: { success: true, data: HO_SO } })
        : Promise.resolve({ data: { success: true, data: [] } }),
    );
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('chế độ SỬA: khu tệp đứng cạnh ô kết quả, và CHỈ hỏi tệp đúng loại', async () => {
    await mo('/petitions/p1/edit');
    await waitFor(() => expect(screen.getByTestId('field-ketQuaXuLyKhac')).toBeInTheDocument());
    expect(screen.getByTestId('khu-tep-ket-qua')).toBeInTheDocument();

    /*
      Lọc phải xảy ra TRÊN MÁY CHỦ. Lọc ở trình duyệt thì `limit=100` có thể đã cắt mất tệp cần,
      và bộ đếm trên cột danh sách sẽ đếm khác thứ khu này hiện — hai con số cho một sự thật.
    */
    await waitFor(() => {
      const goi = apiGet.mock.calls
        .map((c) => String(c[0]))
        .filter((d) => d.startsWith('/documents?'));
      expect(goi.length).toBeGreaterThan(0);
      expect(
        goi.some((d) => d.includes('petitionId=p1') && d.includes(`documentType=${LOAI_TEP_KET_QUA}`)),
        'khu tệp kết quả hỏi máy chủ mà KHÔNG lọc loại — sẽ hiện lẫn mọi tệp cũ',
      ).toBe(true);
    });
  }, 25_000);

  it('chế độ TẠO MỚI: vẫn có khu tệp, xếp hàng riêng, không trùng khu tệp chung', async () => {
    await mo('/petitions/new');
    await waitFor(() => expect(screen.getByTestId('field-ketQuaXuLyKhac')).toBeInTheDocument());
    expect(screen.getByTestId('khu-tep-ket-qua')).toBeInTheDocument();
    // Hai khu xếp hàng riêng biệt — cùng một testid là ca kiểm mù và cán bộ cũng không phân biệt được.
    expect(screen.getByTestId('stage-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('stage-ket-qua-file-input')).toBeInTheDocument();
  }, 25_000);

  it('ô "Kết quả xử lý" vẫn nhập và lưu được như cũ', async () => {
    await mo('/petitions/p1/edit');
    const o = await screen.findByTestId('field-ketQuaXuLyKhac');
    await waitFor(() => expect((o as HTMLTextAreaElement).value).toBe('Đã chuyển Công an phường'));
  }, 25_000);
});
