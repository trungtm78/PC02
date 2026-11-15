/**
 * Hai tab "Phân công xử lý" / "Kết quả xử lý" trên form Đơn thư: chỉ có khi công tắc `processing_flow_records` BẬT,
 * hồ sơ ĐÃ LƯU và người dùng có `read:ProcessingStep`. Chúng đứng NGAY SAU tab Thông tin, trước các tab còn lại của hệ cũ, và không đụng tới trạng thái tab cũ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { LEGACY_TAB_LABEL } from '@/features/cases/legacy-form-layout.def';
import { READ_STEP, recordApiAnswer, signIn } from '@/features/processing-flow/record-tabs/__tests__/formHarness';
import { Providers } from '@/features/processing-flow/record-tabs/__tests__/FormProviders';

Element.prototype.scrollIntoView = vi.fn();

const BAN_GHI = {
  id: 'pet-1',
  stt: '2026-12345',
  receivedDate: '2026-03-12T00:00:00.000Z',
  senderName: 'Trần Thị A',
  summary: 'Tóm tắt',
  detailContent: 'Nội dung',
  status: 'DANG_XU_LY',
  quyenGhi: true,
  updatedAt: '2026-03-12T01:00:00.000Z',
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (/^\/petitions\/pet-1$/.test(url)) return Promise.resolve({ data: { success: true, data: BAN_GHI } });
      const record = recordApiAnswer(url, 'PETITION', 'pet-1');
      if (record) return Promise.resolve(record);
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

type Cfg = { path: string; switchOn?: boolean | null; permissions?: string[]; cheDo?: 'xem' | 'sua' };

async function renderPage({ path, switchOn = true, permissions = [READ_STEP], cheDo = 'sua' }: Cfg) {
  signIn(permissions);
  const { PetitionFormPage } = await import('../PetitionFormPage');
  return render(
    <Providers switchOn={switchOn}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
          <Route path="/petitions/:id" element={<PetitionFormPage cheDo={cheDo} />} />
          <Route path="/petitions/:id/edit" element={<PetitionFormPage cheDo={cheDo} />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

const legacyButtons = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="tab-nut-"]')).filter(
    (el) => !['tab-nut-phan-cong-xu-ly', 'tab-nut-ket-qua-xu-ly'].includes(el.getAttribute('data-testid') ?? ''),
  );
const recordPaths = () => vi.mocked(api.get).mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/processing/records'));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(api.get).mockClear();
});

describe('PetitionFormPage — hai tab quy trình', () => {
  it('có đủ hai tab NGAY SAU tab Thông tin khi công tắc bật, hồ sơ đã lưu và có quyền đọc bước', async () => {
    await renderPage({ path: '/petitions/pet-1/edit' });
    await screen.findByTestId('tab-nut-phan-cong-xu-ly');
    expect(screen.getByTestId('tab-nut-ket-qua-xu-ly')).toHaveTextContent('Kết quả xử lý');
    const bar = screen.getByTestId('thanh-tab-don-thu');
    const order = Array.from(bar.querySelectorAll('button')).map((b) => b.textContent);
    expect(order).toEqual(['Thông tin', 'Phân công xử lý', 'Kết quả xử lý', ...Object.values(LEGACY_TAB_LABEL).slice(1)]);
    expect(legacyButtons().map((b) => b.textContent)).toEqual(Object.values(LEGACY_TAB_LABEL));
  });

  it('mở tab: thân tab hiện, tab cũ bị gỡ khỏi màn; bấm lại tab cũ thì thân tab quy trình biến mất và tab Thông tin còn nguyên', async () => {
    await renderPage({ path: '/petitions/pet-1/edit' });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    fireEvent.click(await screen.findByTestId('tab-nut-phan-cong-xu-ly'));
    expect(await screen.findByTestId('assignment-steps')).toBeInTheDocument();
    expect(recordPaths()).toEqual(['/processing/records/PETITION/pet-1']);
    // Ô của tab Thông tin vẫn nằm trong cây (ẩn bằng CSS), nên chữ đang gõ không mất.
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).closest('.hidden')).not.toBeNull();
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A');

    fireEvent.click(screen.getByTestId('tab-nut-ket-qua-xu-ly'));
    expect(await screen.findByTestId('results-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-tab')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-nut-info'));
    expect(screen.queryByTestId('results-tab')).toBeNull();
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).closest('.hidden')).toBeNull();
  });

  it('cũng có ở màn chỉ xem', async () => {
    await renderPage({ path: '/petitions/pet-1', cheDo: 'xem' });
    expect(await screen.findByTestId('tab-nut-phan-cong-xu-ly')).toBeInTheDocument();
    expect(screen.getByTestId('bang-che-do-xem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-nut-phan-cong-xu-ly'));
    expect(await screen.findByTestId('assignment-tab')).toBeInTheDocument();
  });

  it('KHÔNG có khi công tắc tắt: không nút, không lời gọi nào tới /processing/records', async () => {
    await renderPage({ path: '/petitions/pet-1/edit', switchOn: false });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(screen.queryByTestId('tab-nut-ket-qua-xu-ly')).toBeNull();
    expect(legacyButtons()).toHaveLength(Object.keys(LEGACY_TAB_LABEL).length);
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có khi công tắc chưa được gieo', async () => {
    await renderPage({ path: '/petitions/pet-1/edit', switchOn: null });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
  });

  it('KHÔNG có khi người dùng thiếu quyền read:ProcessingStep', async () => {
    await renderPage({ path: '/petitions/pet-1/edit', permissions: ['read:ProcessingFlow', 'assign:ProcessingStep'] });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có ở màn tạo mới (chưa có id)', async () => {
    await renderPage({ path: '/petitions/new' });
    await screen.findByTestId('thanh-tab-don-thu');
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(screen.queryByTestId('tab-nut-ket-qua-xu-ly')).toBeNull();
    expect(legacyButtons()).toHaveLength(Object.keys(LEGACY_TAB_LABEL).length);
  });

  it('đường dẫn ?tab=phan-cong-xu-ly (màn Theo dõi xử lý dẫn tới) mở thẳng tab Phân công xử lý; bấm tab khác vẫn chuyển được', async () => {
    await renderPage({ path: '/petitions/pet-1?tab=phan-cong-xu-ly', cheDo: 'xem' });
    expect(await screen.findByTestId('assignment-tab')).toBeInTheDocument();
    expect(recordPaths()).toEqual(['/processing/records/PETITION/pet-1']);
    fireEvent.click(screen.getByTestId('tab-nut-info'));
    expect(screen.queryByTestId('assignment-tab')).toBeNull();
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).closest('.hidden')).toBeNull();
  });

  it('đường dẫn ?tab=ket-qua-xu-ly mở tab Kết quả xử lý; giá trị lạ thì mở tab Thông tin như thường', async () => {
    const view = await renderPage({ path: '/petitions/pet-1/edit?tab=ket-qua-xu-ly' });
    expect(await screen.findByTestId('results-tab')).toBeInTheDocument();
    view.unmount();
    await renderPage({ path: '/petitions/pet-1/edit?tab=khong-co' });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).closest('.hidden')).toBeNull();
    expect(screen.queryByTestId('assignment-tab')).toBeNull();
  });

  it('đường dẫn ?tab=phan-cong-xu-ly khi công tắc TẮT: form mở tab Thông tin, không gọi /processing/records', async () => {
    await renderPage({ path: '/petitions/pet-1/edit?tab=phan-cong-xu-ly', switchOn: false });
    await waitFor(() => expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Trần Thị A'), { timeout: 5000 });
    expect((screen.getByTestId('field-senderName') as HTMLInputElement).closest('.hidden')).toBeNull();
    expect(screen.queryByTestId('assignment-tab')).toBeNull();
    expect(recordPaths()).toEqual([]);
  });
});
