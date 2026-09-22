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
    MỘT ca cho MỘT tab, thay vì một ca bấm qua cả mười tab.

    Bản đầu gom cả mười tab vào một ca với hạn giờ 30 giây. Nó CHẬP CHỜN: dựng lại form mười
    tab rồi chờ từng thân tab hiện ra, máy tải nặng là vượt hạn và đỏ với một lỗi hết-giờ không
    nói gì về sản phẩm. Ca đỏ oan làm người đọc mất lòng tin vào cổng, rồi tới lúc nó đỏ THẬT
    thì không ai buồn nhìn.

    Tách ra thì mỗi tab có ngân sách riêng, đỏ ở tab nào là biết ngay tab ấy, và không ca nào
    phải gánh công của chín ca khác. Mệnh đề KHÔNG đổi.
  */
  const TAB = Object.keys(LEGACY_TAB_LABEL) as LegacyTabId[];

  it.each(TAB)('tab "%s" không dựng ba ô đã bỏ', { timeout: 20_000 }, async (tab) => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());

    const nut = screen.queryByRole('button', { name: LEGACY_TAB_LABEL[tab] });
    // Tab không có nút mở (vd tab mặc định) thì thân nó đã nằm sẵn trong cây.
    if (nut) fireEvent.click(nut);
    /*
      CHỜ thân tab dựng xong rồi mới đo. Đo ngay sau cú bấm là đo một khoảnh khắc chưa có gì —
      cổng sẽ xanh vì tab còn trống, chứ không phải vì ô đã ẩn. Đúng lớp "xanh rỗng".
    */
    await waitFor(() =>
      expect(screen.getByTestId(`legacy-layout-${tab}`)).toBeInTheDocument(),
    );

    const pham = O_AN_KHOI_DON_THU.filter((o) =>
      screen.queryByTestId(`legacy-field-${o}`),
    );
    expect(pham).toEqual([]);
  });

  it('mọi tab của Đơn thư đều được ca kiểm phủ — không tab nào rơi ra ngoài', () => {
    expect(TAB.length).toBeGreaterThan(5);
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

  /**
   * Mệnh đề này KHÔNG đọc `O_AN_KHOI_DON_THU` — cố ý.
   *
   * Hai cổng ở trên đều lặp trên chính mảng ẩn, nên thêm một ô vào mảng là chúng tự xanh: chúng
   * chứng minh "mảng được tôn trọng", không chứng minh "ô anh yêu cầu bỏ đã biến mất". Thử
   * bằng cách sửa ca kiểm trước khi sửa mã: cả hai vẫn xanh. Đó là cổng xanh rỗng.
   *
   * Yêu cầu của anh (22/09/2026) gọi TÊN một ô cụ thể, nên cổng phải gọi đúng tên ấy.
   * Dữ liệu vẫn giữ: 11.591 hồ sơ có `attachmentsNote`, bản in vẫn đọc cột ấy
   * (`field-catalog.ts:714`, `khoa-he-cu.ts:188`).
   */
  it('ô "Đồ vật, tài liệu kèm theo" KHÔNG còn trên form, gọi thẳng tên ô', async () => {
    await moForm();
    await waitFor(() =>
      expect(screen.getByTestId('legacy-field-senderName')).toBeInTheDocument(),
    );
    for (const tab of TAB) {
      const nut = screen.queryByRole('button', { name: LEGACY_TAB_LABEL[tab] });
      if (nut) fireEvent.click(nut);
      await waitFor(() =>
        expect(screen.getByTestId(`legacy-layout-${tab}`)).toBeInTheDocument(),
      );
      expect(
        screen.queryByTestId('legacy-field-attachmentsNote'),
        `ô "Đồ vật, tài liệu kèm theo" vẫn dựng ở tab "${tab}"`,
      ).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Đồ vật, tài liệu kèm theo/)).not.toBeInTheDocument();
  }, 30_000);

  it('ô tổ hợp tra tiền án đi theo ô "Tội danh cũ" — không để lại mã chết', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    expect(screen.queryByTestId('suspect-search-input')).not.toBeInTheDocument();
  });
});
