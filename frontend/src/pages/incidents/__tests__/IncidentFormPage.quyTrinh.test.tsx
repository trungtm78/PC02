/**
 * Hai tab "Phân công xử lý" / "Kết quả xử lý" trên form Vụ việc: chỉ có khi công tắc `processing_flow_records` BẬT,
 * hồ sơ ĐÃ LƯU và người dùng có `read:ProcessingStep`. Chúng đứng NGAY SAU tab Thông tin, trước các tab còn lại của hệ cũ, và không đụng tới trạng thái tab cũ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsync } from '@/test-utils/renderAsync';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { LEGACY_TAB_LABEL } from '@/features/cases/legacy-form-layout.def';
import { READ_STEP, recordApiAnswer, signIn } from '@/features/processing-flow/record-tabs/__tests__/formHarness';
import { Providers } from '@/features/processing-flow/record-tabs/__tests__/FormProviders';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      const record = recordApiAnswer(url, 'INCIDENT', 'inc-1');
      if (record) return Promise.resolve(record);
      if (url.startsWith('/incidents/')) {
        return Promise.resolve({ data: { success: true, data: { name: 'Vụ việc test', updatedAt: '2026-06-27T00:00:00Z' } } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'inc-new' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'VV-2026-00001' }) },
}));

type Cfg = { path: string; switchOn?: boolean | null; permissions?: string[]; readOnly?: boolean };

async function renderPage({ path, switchOn = true, permissions = [READ_STEP], readOnly = false }: Cfg) {
  signIn(permissions);
  const { IncidentFormPage } = await import('../IncidentFormPage');
  return renderAsync(
    <Providers switchOn={switchOn}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/vu-viec/new" element={<IncidentFormPage />} />
          <Route path="/vu-viec/:id/edit" element={<IncidentFormPage readOnly={readOnly} />} />
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
const nameField = () => screen.getByTestId('field-name') as HTMLInputElement;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(api.get).mockClear();
});

describe('IncidentFormPage — hai tab quy trình', () => {
  it('có đủ hai tab NGAY SAU tab Thông tin khi công tắc bật, hồ sơ đã lưu và có quyền đọc bước', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit' });
    await screen.findByTestId('tab-nut-phan-cong-xu-ly');
    const bar = screen.getByTestId('thanh-tab-vu-viec');
    expect(Array.from(bar.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Thông tin', 'Phân công xử lý', 'Kết quả xử lý', ...Object.values(LEGACY_TAB_LABEL).slice(1)]);
    expect(legacyButtons().map((b) => b.textContent)).toEqual(Object.values(LEGACY_TAB_LABEL));
  });

  it('mở tab: thân tab hiện, chữ đã gõ ở tab Thông tin còn nguyên; bấm lại tab cũ thì thân tab quy trình biến mất', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit' });
    await waitFor(() => expect(nameField().value).toBe('Vụ việc test'));
    fireEvent.change(nameField(), { target: { value: 'Tên đang sửa dở' } });

    fireEvent.click(await screen.findByTestId('tab-nut-phan-cong-xu-ly'));
    expect(await screen.findByTestId('assignment-steps')).toBeInTheDocument();
    expect(recordPaths()).toEqual(['/processing/records/INCIDENT/inc-1']);
    expect(nameField().closest('.hidden')).not.toBeNull();

    fireEvent.click(screen.getByTestId('tab-nut-ket-qua-xu-ly'));
    expect(await screen.findByTestId('results-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-tab')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-nut-info'));
    expect(screen.queryByTestId('results-tab')).toBeNull();
    expect(nameField().closest('.hidden')).toBeNull();
    // Chuyển qua lại không làm mất, cũng không đánh dấu gì: chữ đang sửa dở vẫn nguyên.
    expect(nameField().value).toBe('Tên đang sửa dở');
  });

  it('cũng có ở màn chỉ xem', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit', readOnly: true });
    fireEvent.click(await screen.findByTestId('tab-nut-phan-cong-xu-ly'));
    expect(await screen.findByTestId('assignment-tab')).toBeInTheDocument();
  });

  it('KHÔNG có khi công tắc tắt: không nút, không lời gọi nào tới /processing/records', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit', switchOn: false });
    await waitFor(() => expect(nameField().value).toBe('Vụ việc test'));
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(screen.queryByTestId('tab-nut-ket-qua-xu-ly')).toBeNull();
    expect(legacyButtons()).toHaveLength(Object.keys(LEGACY_TAB_LABEL).length);
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có khi công tắc chưa được gieo', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit', switchOn: null });
    await waitFor(() => expect(nameField().value).toBe('Vụ việc test'));
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
  });

  it('KHÔNG có khi người dùng thiếu quyền read:ProcessingStep', async () => {
    await renderPage({ path: '/vu-viec/inc-1/edit', permissions: ['read:ProcessingFlow', 'assign:ProcessingStep'] });
    await waitFor(() => expect(nameField().value).toBe('Vụ việc test'));
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có ở màn tạo mới (chưa có id)', async () => {
    await renderPage({ path: '/vu-viec/new' });
    await screen.findByTestId('thanh-tab-vu-viec');
    expect(screen.queryByTestId('tab-nut-phan-cong-xu-ly')).toBeNull();
    expect(screen.queryByTestId('tab-nut-ket-qua-xu-ly')).toBeNull();
    expect(legacyButtons()).toHaveLength(Object.keys(LEGACY_TAB_LABEL).length);
  });
});
