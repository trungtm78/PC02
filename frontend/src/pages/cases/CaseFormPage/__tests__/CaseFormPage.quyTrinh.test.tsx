/**
 * Hai tab "Phân công xử lý" / "Kết quả xử lý" trên form Vụ án: chỉ có khi công tắc `processing_flow_records` BẬT,
 * hồ sơ ĐÃ LƯU và người dùng có `read:ProcessingStep`. Chúng đứng NGAY SAU tab đầu (Thông tin), trước các tab còn lại, cùng thanh, id riêng.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { READ_STEP, recordApiAnswer, signIn } from '@/features/processing-flow/record-tabs/__tests__/formHarness';
import { Providers } from '@/features/processing-flow/record-tabs/__tests__/FormProviders';

Element.prototype.scrollIntoView = vi.fn();

// Các tab của form chứa nhiều con tự gọi mạng; bài này chỉ kiểm thanh tab và thân hai tab mới.
vi.mock('../tabs', () => {
  const Noop = () => null;
  return {
    TabInfo: () => <div data-testid="stub-info" />,
    TabIncident: Noop, TabCase: Noop, TabSubjects: Noop,
    TabIncidentTDC: Noop, TabCaseTDC: Noop, TabEvidence: Noop,
    TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop,
  };
});

const state = vi.hoisted(() => ({ quyenGhi: true }));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.endsWith('/field-schema')) return Promise.resolve({ data: { data: null } });
      const record = recordApiAnswer(url, 'CASE', 'case-1');
      if (record) return Promise.resolve(record);
      if (url.startsWith('/cases/')) {
        return Promise.resolve({
          data: { data: { name: 'Vụ án test', caseProvenance: 'DIRECT_DISCOVERY', updatedAt: '2026-06-27T00:00:00Z', metadata: {}, quyenGhi: state.quyenGhi } },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'case-new' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-2026-00001' }) },
}));

type Cfg = { path: string; switchOn?: boolean | null; permissions?: string[] };

async function renderPage({ path, switchOn = true, permissions = [READ_STEP] }: Cfg) {
  signIn(permissions);
  const { default: CaseFormPage } = await import('../index');
  return render(
    <Providers switchOn={switchOn}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/cases/new" element={<CaseFormPage />} />
          <Route path="/cases/:id/edit" element={<CaseFormPage />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

const tabIds = () => within(screen.getByTestId('tab-list')).getAllByRole('button').map((b) => b.getAttribute('data-testid'));
const recordPaths = () => vi.mocked(api.get).mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/processing/records'));
const FORM_TABS = ['tab-info', 'tab-incident', 'tab-case', 'tab-subjects', 'tab-incident-tdc', 'tab-case-tdc', 'tab-evidence', 'tab-business-files', 'tab-statistics', 'tab-media'];

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  state.quyenGhi = true;
  vi.mocked(api.get).mockClear();
});

describe('CaseFormPage — hai tab quy trình', () => {
  it('có đủ hai tab NGAY SAU tab Thông tin khi công tắc bật, hồ sơ đã lưu và có quyền đọc bước', async () => {
    await renderPage({ path: '/cases/case-1/edit' });
    await screen.findByTestId('tab-phan-cong-xu-ly');
    expect(tabIds()).toEqual([FORM_TABS[0], 'tab-phan-cong-xu-ly', 'tab-ket-qua-xu-ly', ...FORM_TABS.slice(1)]);
    expect(screen.getByTestId('tab-ket-qua-xu-ly')).toHaveTextContent('Kết quả xử lý');
  });

  it('mở tab: thân tab hiện (và không còn thân tab cũ); bấm lại tab cũ thì thân tab quy trình biến mất', async () => {
    await renderPage({ path: '/cases/case-1/edit' });
    await screen.findByTestId('stub-info');
    fireEvent.click(await screen.findByTestId('tab-phan-cong-xu-ly'));
    expect(await screen.findByTestId('assignment-steps')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-info')).toBeNull();
    expect(recordPaths()).toEqual(['/processing/records/CASE/case-1']);

    fireEvent.click(screen.getByTestId('tab-ket-qua-xu-ly'));
    expect(await screen.findByTestId('results-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('assignment-tab')).toBeNull();

    fireEvent.click(screen.getByTestId('tab-info'));
    expect(screen.queryByTestId('results-tab')).toBeNull();
    expect(screen.getByTestId('stub-info')).toBeInTheDocument();
  });

  it('ở màn chỉ xem (không có quyền ghi hồ sơ) hai tab vẫn có và nút thao tác theo quyền BƯỚC, không bị khoá theo cờ chỉ-xem của form', async () => {
    state.quyenGhi = false;
    await renderPage({ path: '/cases/case-1/edit', permissions: [READ_STEP, 'complete:ProcessingStep'] });
    expect(await screen.findByTestId('bang-chi-xem')).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('tab-phan-cong-xu-ly'));
    expect(await screen.findByTestId('step-s1-complete')).toBeEnabled();
  });

  it('KHÔNG có khi công tắc tắt: không nút, không lời gọi nào tới /processing/records', async () => {
    await renderPage({ path: '/cases/case-1/edit', switchOn: false });
    await screen.findByTestId('stub-info');
    expect(tabIds()).toEqual(FORM_TABS);
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có khi công tắc chưa được gieo', async () => {
    await renderPage({ path: '/cases/case-1/edit', switchOn: null });
    await screen.findByTestId('stub-info');
    expect(tabIds()).toEqual(FORM_TABS);
  });

  it('KHÔNG có khi người dùng thiếu quyền read:ProcessingStep', async () => {
    await renderPage({ path: '/cases/case-1/edit', permissions: ['read:ProcessingFlow', 'assign:ProcessingStep'] });
    await screen.findByTestId('stub-info');
    expect(tabIds()).toEqual(FORM_TABS);
    expect(recordPaths()).toEqual([]);
  });

  it('KHÔNG có ở màn tạo mới (chưa có id)', async () => {
    await renderPage({ path: '/cases/new' });
    await screen.findByTestId('tab-list');
    await waitFor(() => expect(tabIds()).toEqual(FORM_TABS));
    expect(screen.queryByTestId('tab-phan-cong-xu-ly')).toBeNull();
  });

  it('đường dẫn ?tab=phan-cong-xu-ly (màn Theo dõi xử lý dẫn tới) mở thẳng tab Phân công xử lý; bấm tab khác vẫn chuyển được', async () => {
    await renderPage({ path: '/cases/case-1/edit?tab=phan-cong-xu-ly' });
    expect(await screen.findByTestId('assignment-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-info')).toBeNull();
    expect(recordPaths()).toEqual(['/processing/records/CASE/case-1']);
    fireEvent.click(screen.getByTestId('tab-info'));
    expect(screen.queryByTestId('assignment-tab')).toBeNull();
    expect(screen.getByTestId('stub-info')).toBeInTheDocument();
    // Tham số chỉ đọc MỘT lần: quay lại tab Thông tin rồi thì form không tự nhảy về tab quy trình nữa.
    fireEvent.click(screen.getByTestId('tab-ket-qua-xu-ly'));
    expect(await screen.findByTestId('results-tab')).toBeInTheDocument();
  });

  it('đường dẫn ?tab=phan-cong-xu-ly khi công tắc TẮT: form mở tab Thông tin, không gọi /processing/records', async () => {
    await renderPage({ path: '/cases/case-1/edit?tab=phan-cong-xu-ly', switchOn: false });
    expect(await screen.findByTestId('stub-info')).toBeInTheDocument();
    expect(tabIds()).toEqual(FORM_TABS);
    expect(recordPaths()).toEqual([]);
  });
});
