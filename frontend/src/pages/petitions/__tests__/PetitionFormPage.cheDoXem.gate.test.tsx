/**
 * CỔNG CẤU TRÚC — chế độ XEM của form Đơn thư (`/petitions/:id`).
 *
 * Dựng form THẬT (không giả FKSelect/CrimeSelect: chính chúng là thứ cần được khoá), duyệt CẢ 10 tab, bung mọi nhóm
 * gập, và đòi MỌI ô nhập đều không sửa được:
 *  - ô chữ/ngày/số/vùng văn bản → `readOnly` (hoặc disabled). Phải là readOnly chứ không disabled để chép được chữ;
 *  - ô tích, chọn, tệp → `disabled` (readOnly KHÔNG chặn được ô tích);
 *  - ô combobox tự dựng (FKSelect, CrimeSelect) → `disabled` hoặc `aria-disabled`.
 *
 * Vì sao là cổng chứ không chỉ vài ca kiểm: form có hàng trăm ô trải trên 10 tab; một ô mới thêm về sau mà quên chế độ
 * xem sẽ vẫn gõ được ở màn "chỉ xem" — lỗi im lặng, không ca kiểm đơn lẻ nào thấy. Cổng này đỏ ngay và ghi rõ ô nào.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { LEGACY_TAB_LABEL, type LegacyTabId } from '@/features/cases/legacy-form-layout.def';

Element.prototype.scrollIntoView = vi.fn();

const BAN_GHI = {
  id: 'pet-1',
  stt: '2026-12345',
  receivedDate: '2026-03-12T00:00:00.000Z',
  senderName: 'Trần Thị A',
  senderPhone: '0900000000',
  senderAddress: '12 Nguyễn Huệ',
  suspectedPerson: 'Lê Văn B',
  summary: 'Tóm tắt',
  detailContent: 'Nội dung tố giác cần được chép ra chỗ khác',
  status: 'DANG_XU_LY',
  quyenGhi: true,
  updatedAt: '2026-03-12T01:00:00.000Z',
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (/^\/petitions\/pet-1$/.test(url)) return Promise.resolve({ data: { success: true, data: BAN_GHI } });
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001' }) },
}));

const PROFILE: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'a',
  firstName: 'A',
  lastName: 'B',
  role: 'OFFICER',
  canDispatch: false,
  teams: [{ teamId: 'team-doi-1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 'team-doi-1', teamName: 'Đội 1' },
};

async function renderTrang(duong: string, cheDo: 'xem' | 'sua') {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[duong]}>
        <Routes>
          <Route path="/petitions/:id" element={<PetitionFormPage cheDo={cheDo} />} />
          <Route path="/petitions/:id/edit" element={<PetitionFormPage cheDo={cheDo} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CHU = new Set(['text', 'date', 'number', 'tel', 'email', 'search', 'url', 'time', 'password', 'datetime-local', 'month', 'week', '']);

/** Mô tả ngắn một ô để báo lỗi: tab, loại, testid hoặc nhãn. */
function moTa(el: Element, tab: string) {
  const e = el as HTMLInputElement;
  const nhan =
    e.getAttribute('data-testid') ||
    e.getAttribute('aria-label') ||
    e.id ||
    (e.closest('[data-testid]')?.getAttribute('data-testid') ?? '') ||
    e.tagName.toLowerCase();
  return `[${tab}] <${e.tagName.toLowerCase()}${e.type ? ` type=${e.type}` : ''}${e.getAttribute('role') ? ` role=${e.getAttribute('role')}` : ''}> ${nhan}`;
}

/** Ô nhập này CÓ sửa được ở chế độ xem không? Trả về mô tả nếu CÒN SỬA ĐƯỢC. */
function oConSua(el: Element, tab: string): string | null {
  const tag = el.tagName.toLowerCase();
  const e = el as HTMLInputElement;
  const khoa = e.disabled === true || el.getAttribute('aria-disabled') === 'true';
  if (tag === 'input') {
    if (e.type === 'hidden') return null;
    if (CHU.has(e.type)) return e.readOnly || khoa ? null : moTa(el, tab);
    // checkbox / radio / file / range / color…: readOnly KHÔNG chặn được → phải disabled.
    return khoa ? null : moTa(el, tab);
  }
  if (tag === 'textarea') return e.readOnly || khoa ? null : moTa(el, tab);
  if (tag === 'select') return khoa ? null : moTa(el, tab);
  // điều khiển tự dựng (div/button mang vai trò nhập liệu): phải bị khoá hẳn
  if (VAI_TRO_NHAP.includes(el.getAttribute('role') ?? '')) return khoa ? null : moTa(el, tab);
  if (el.getAttribute('contenteditable') === 'true') return moTa(el, tab);
  return null;
}

function bungMoiNhom() {
  // Bung các nhóm gập (NhomOGap) để thấy hết ô bên trong.
  for (let lan = 0; lan < 3; lan += 1) {
    const nut = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="nhom-"][data-testid$="-nut"]')).filter(
      (n) => n.getAttribute('aria-expanded') === 'false',
    );
    if (!nut.length) break;
    nut.forEach((n) => fireEvent.click(n));
  }
}

// Gồm cả các điều khiển tự dựng mang vai trò nhập liệu: nút `role=radio` (vd "Hướng xử lý") ĐỔI dữ liệu mà không phải
// <input>. Bản đầu của cổng chỉ nhìn thẻ input/textarea/select nên lọt chúng.
const VAI_TRO_NHAP = ['combobox', 'radio', 'switch', 'checkbox', 'spinbutton', 'slider', 'textbox', 'listbox'];
const SELECTOR = ['input', 'textarea', 'select', '[contenteditable="true"]', ...VAI_TRO_NHAP.map((v) => `[role="${v}"]`)].join(', ');

describe('PetitionFormPage — chế độ XEM: mọi ô nhập trên cả 10 tab đều không sửa được', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(PROFILE);
  });
  afterEach(() => vi.clearAllMocks());

  it('duyệt đủ 10 tab của hệ cũ', () => {
    expect(Object.keys(LEGACY_TAB_LABEL)).toHaveLength(10);
  });

  it('không còn ô nào gõ/chọn/tích được (báo rõ ô nào, ở tab nào)', async () => {
    await renderTrang('/petitions/pet-1', 'xem');
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), {
      timeout: 5000,
    });

    const conSua: string[] = [];
    let tongO = 0;
    for (const tab of Object.keys(LEGACY_TAB_LABEL) as LegacyTabId[]) {
      fireEvent.click(screen.getByTestId(`tab-nut-${tab}`));
      bungMoiNhom();
      const form = document.querySelector('[data-testid="petition-form-page"] form') as HTMLElement;
      const oNhap = Array.from(form.querySelectorAll(SELECTOR)).filter(
        // Ô của tab đang ẩn bằng CSS (`hidden`) vẫn nằm trong cây: chỉ tính ô thuộc tab đang mở.
        (el) => !el.closest('.hidden'),
      );
      tongO += oNhap.length;
      for (const el of oNhap) {
        const loi = oConSua(el, tab);
        if (loi) conSua.push(loi);
      }
    }
    // Cổng phải thật sự DUYỆT ô (không xanh vì cây rỗng).
    expect(tongO).toBeGreaterThan(40);
    // Nối thành chuỗi để thông báo lỗi in ĐỦ từng ô (mảng bị cắt ở 10 phần tử).
    expect(conSua.join('\n')).toBe('');
  }, 60000);

  it('đối chứng: ở chế độ SỬA cùng cổng này thấy ô sửa được (cổng không mù)', async () => {
    await renderTrang('/petitions/pet-1/edit', 'sua');
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), {
      timeout: 5000,
    });
    const form = document.querySelector('[data-testid="petition-form-page"] form') as HTMLElement;
    const sua = Array.from(form.querySelectorAll(SELECTOR))
      .filter((el) => !el.closest('.hidden'))
      .map((el) => oConSua(el, 'info'))
      .filter(Boolean);
    expect(sua.length).toBeGreaterThan(10);
  }, 30000);
});

describe('PetitionFormPage — chế độ XEM: giao diện', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(PROFILE);
  });
  afterEach(() => vi.clearAllMocks());

  it('tiêu đề là "Chi tiết", có nút Sửa dẫn sang /edit, không có nút Lưu, có dải "Đang xem"', async () => {
    await renderTrang('/petitions/pet-1', 'xem');
    await waitFor(() => expect(screen.getByRole('heading', { name: /Chi tiết Đơn thư/ })).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByTestId('btn-sua-don')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-save-top-main')).not.toBeInTheDocument();
    expect(screen.getByTestId('bang-che-do-xem')).toHaveTextContent(/Đang xem/);
    // Dải "ngoài phạm vi ghi" là của trường hợp KHÔNG có quyền; ở đây người dùng có quyền nên không hiện.
    expect(screen.queryByTestId('bang-chi-xem')).not.toBeInTheDocument();
  });

  it('chữ trong ô vẫn ĐỦ để chép: ô chữ readOnly nhưng KHÔNG disabled', async () => {
    await renderTrang('/petitions/pet-1', 'xem');
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), {
      timeout: 5000,
    });
    const o = screen.getByTestId('field-senderName') as HTMLInputElement;
    expect(o.readOnly).toBe(true);
    expect(o.disabled).toBe(false);
  });

  it('chế độ SỬA: có nút Lưu, không có nút Sửa, không có dải "Đang xem"', async () => {
    await renderTrang('/petitions/pet-1/edit', 'sua');
    await waitFor(() => expect(screen.getByTestId('btn-save-top-main')).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByTestId('btn-sua-don')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bang-che-do-xem')).not.toBeInTheDocument();
    expect(within(document.body).getByRole('heading', { name: /Cập nhật Đơn thư/ })).toBeInTheDocument();
  });
});
