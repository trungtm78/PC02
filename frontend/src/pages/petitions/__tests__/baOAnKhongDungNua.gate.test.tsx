import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { LEGACY_TAB_LABEL, type LegacyTabId } from '@/features/cases/legacy-form-layout.def';
import { O_AN_KHOI_DON_THU } from '@/features/petitions/o-an.def';

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
  role: 'ADMIN', canDispatch: true,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

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
 * CỔNG: ba ô anh yêu cầu bỏ không được dựng ở BẤT KỲ tab nào của Đơn thư.
 *
 * Đo bằng cấu trúc (`legacy-field-<tên ô>`) chứ không dò lời văn: nhãn đổi một chữ là cổng
 * dò-chữ lặng lẽ thành xanh rỗng trong khi ô vẫn nằm đó.
 */
describe('CỔNG: ba ô đã bỏ không dựng ở tab nào của Đơn thư', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { success: true, data: [] } });
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  /*
    Hạn giờ rộng: ca này dựng form 10 tab rồi mở LẦN LƯỢT từng tab và chờ thân tab hiện ra.
    Hạn 5 giây mặc định đủ khi chạy riêng nhưng không đủ khi chạy trọn bộ — và lúc ấy ca đỏ
    với một lỗi hết-giờ không nói gì về sản phẩm, đúng kiểu đỏ oan làm người đọc mất lòng tin
    vào cổng. Nới hạn giờ KHÔNG nới mệnh đề.
  */
  it('mở LẦN LƯỢT mọi tab — không tab nào dựng ba ô ấy', { timeout: 30_000 }, async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());

    const pham: string[] = [];
    const daMo: string[] = [];
    for (const tab of Object.keys(LEGACY_TAB_LABEL) as LegacyTabId[]) {
      const nut = screen.queryByRole('button', { name: LEGACY_TAB_LABEL[tab] });
      if (!nut) continue;
      fireEvent.click(nut);
      /*
        CHỜ thân tab dựng xong rồi mới đo. Đo ngay sau cú bấm là đo một khoảnh khắc chưa có
        gì — cổng sẽ xanh vì tab còn trống, chứ không phải vì ô đã ẩn. Đúng lớp "xanh rỗng".
      */
      await waitFor(() => expect(screen.getByTestId(`legacy-layout-${tab}`)).toBeInTheDocument());
      daMo.push(tab);
      for (const o of O_AN_KHOI_DON_THU)
        if (screen.queryByTestId(`legacy-field-${o}`))
          pham.push(`tab "${LEGACY_TAB_LABEL[tab]}" còn dựng ô "${o}"`);
    }
    // Mở được ít tab bất thường nghĩa là phép đo không chạm tới nơi — nói ra thay vì xanh rỗng.
    expect(daMo.length, `chỉ mở được ${daMo.length} tab: ${daMo.join(', ')}`).toBeGreaterThan(5);
    expect(pham, 'anh yêu cầu bỏ ba ô này khỏi màn Đơn thư').toEqual([]);
  });

  /**
   * Cổng trên mà chạy trên một form KHÔNG dựng ô nào thì xanh rỗng. Mệnh đề này chứng minh
   * phép đo có chạm được vào ô thật: một ô khác CÙNG TAB vẫn phải dựng ra.
   */
  it('phép đo có chạm được ô thật — ô cùng tab vẫn dựng bình thường', async () => {
    await moForm();
    await waitFor(() =>
      expect(screen.getByTestId('legacy-field-senderName')).toBeInTheDocument(),
    );
  });

  it('ô tổ hợp tra tiền án đi theo ô "Tội danh cũ" — không để lại mã chết', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    expect(screen.queryByTestId('suspect-search-input')).not.toBeInTheDocument();
  });
});
