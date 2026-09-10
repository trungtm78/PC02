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
    ['field-donViGiaiQuyet', 'ô Đơn vị xử lý'],
    ['field-deXuat', 'ô Đề xuất'],
  ])('%s (%s) không bị gập trong thẻ đóng', async (testId) => {
    await moForm();
    const el = await screen.findByTestId(testId);
    expect(biGapLai(el)).toBe(false);
  });

  /**
   * Anh chốt 10/09/2026: khối phải nằm NGAY DƯỚI ô "Nhận xét".
   *
   * Vị trí không phải chuyện thẩm mỹ — đọc tới Nhận xét là tới bước quyết định hướng xử lý.
   * Ô "Nhận xét" của bố cục hệ cũ mang tên `nhanXet`, nhưng với Đơn thư nó được `doiTab` dịch
   * thành `nhanThay`; dùng nhầm tên hệ cũ thì khối biến mất KHÔNG báo lỗi.
   */
  it('nằm NGAY SAU ô Nhận xét, không phải cuối tab', async () => {
    await moForm();
    const khoi = await screen.findByTestId('section-noi-dung-phieu-de-xuat');
    const nhanXet = document.querySelector('[name="nhanThay"], [data-testid="legacy-field-nhanThay"]')
      ?? [...document.querySelectorAll('textarea')].find(
        (x) => (x.getAttribute('placeholder') ?? '').includes('Nhận xét về vụ việc'),
      );
    expect(nhanXet).toBeTruthy();

    // Đứng SAU ô Nhận xét theo thứ tự đọc của tài liệu.
    const sau = nhanXet!.compareDocumentPosition(khoi) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(Boolean(sau)).toBe(true);

    // Và đứng NGAY SAU: ô lưới liền trước khối chính là ô chứa Nhận xét. Đo quan hệ anh-em
    // trong lưới thay vì đếm ô nhập — đếm thì đổi bố cục một chút là đỏ oan.
    const oLienTruoc = khoi.parentElement?.previousElementSibling ?? null;
    expect(oLienTruoc?.contains(nhanXet as Node) ?? false).toBe(true);
  });

  it('không nằm dưới nhãn "Bổ sung hệ mới"', async () => {
    await moForm();
    const khoi = await screen.findByTestId('section-noi-dung-phieu-de-xuat');
    await waitFor(() => expect(khoi).toBeTruthy());
    const goi = document.querySelector('[data-testid^="bo-sung-he-moi-"]');
    expect(goi?.contains(khoi) ?? false).toBe(false);
  });
});

describe('chỉ còn MỘT ô hỏi đơn vị trên form Đơn thư', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); authStore.setProfile(NGUOI_DUNG); });
  afterEach(() => { vi.clearAllMocks(); });

  /**
   * Anh yêu cầu 10/09/2026: gộp "Đơn vị giải quyết" và "Đơn vị xử lý" thành MỘT trường.
   *
   * Trước đó form có hai ô hỏi cùng một thứ, ghi vào hai cột khác nhau — điền ô này thì ô kia
   * vẫn trống, và bản in phải đoán bằng đường lùi. ĐẾM số ô chứ không chỉ kiểm ô mới còn đó:
   * ô cũ vẫn nằm trong bố cục hệ cũ dùng chung, chỉ bị lọc riêng cho Đơn thư.
   */
  it('đúng MỘT ô, và nó ghi vào cột donViGiaiQuyet', async () => {
    await moForm();
    await screen.findByTestId('section-noi-dung-phieu-de-xuat');
    expect(screen.getAllByTestId('field-donViGiaiQuyet')).toHaveLength(1);
    // Ô cũ ghi cột khác đã biến hẳn.
    expect(screen.queryAllByTestId('field-donViXuLy')).toHaveLength(0);
  });

  it('ô duy nhất ấy nằm trong khối "Nội dung phiếu đề xuất", cạnh ba nút hướng xử lý', async () => {
    await moForm();
    const khoi = await screen.findByTestId('section-noi-dung-phieu-de-xuat');
    expect(khoi.contains(screen.getByTestId('field-donViGiaiQuyet'))).toBe(true);
    expect(khoi.contains(screen.getByTestId('field-huongXuLy-CHUYEN_DON'))).toBe(true);
  });
});
