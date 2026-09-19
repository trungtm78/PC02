/**
 * Form SỬA Vụ án / Vụ việc / Đơn thư khi người mở CHỈ ĐỌC được hồ sơ (vd điều phối viên mở hồ sơ tổ khác, hoặc gõ
 * thẳng URL `/…/:id/edit`): trước đây form mở như thường, cán bộ nhập xong bấm Lưu mới nhận 403 — mất công nhập.
 * Nay máy chủ trả `quyenGhi` (#439, #440, 20/09/2026): form vẫn cho XEM đủ (Đơn thư không có trang xem riêng), nhưng
 * báo "Chỉ xem" ngay đầu trang, ẩn mọi nút ghi, và đường gửi form (Enter / phím tắt) cũng không gọi máy chủ.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { api } from '@/lib/api';

let quyenGhi: boolean | undefined;
// Phím tắt form (F2 Lưu, F3 Xoá): bắt handler lần dựng gần nhất để gọi thẳng — useShortcut cần provider.
let phimTat: { onSave?: () => void; canDelete?: boolean } = {};
vi.mock('@/hooks/useFormShortcuts', () => ({
  useFormShortcuts: (h: typeof phimTat) => {
    phimTat = h;
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (/^\/(cases|incidents|petitions)\/[^/]+$/.test(url)) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'x1',
              name: 'Hồ sơ thử',
              stt: '2026-1',
              receivedDate: '2026-01-01',
              senderName: 'Nguyễn Văn A',
              senderAddress: 'Phường 1',
              detailContent: 'Nội dung',
              receiveDate: '2026-01-01',
              investigatorId: 'u1',
              petitionType: 'TO_CAO',
              summary: 'Tóm tắt',
              caseProvenance: 'DIRECT_DISCOVERY',
              updatedAt: '2026-06-27T00:00:00Z',
              metadata: {},
              quyenGhi,
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'moi' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'X-2026-00001' }) },
}));
vi.mock('@/features/document-templates/components/DynamicExportDocumentsModal', () => ({
  DynamicExportDocumentsModal: () => null,
}));
// Tab của form Vụ án tự tải nhiều danh mục — ca này chỉ kiểm phần đầu/chân form.
vi.mock('@/pages/cases/CaseFormPage/tabs', () => {
  const Noop = () => null;
  return {
    TabInfo: Noop, TabIncident: Noop, TabCase: Noop, TabSubjects: Noop,
    TabIncidentTDC: Noop, TabCaseTDC: Noop, TabEvidence: Noop,
    TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop,
    MucConKhiSua: Noop,
  };
});

function dung(path: string, url: string, trang: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={trang} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const FORM = [
  {
    ten: 'Vụ án',
    mo: async () => {
      const { default: CaseFormPage } = await import('@/pages/cases/CaseFormPage');
      return dung('/cases/:id/edit', '/cases/x1/edit', <CaseFormPage />);
    },
    nutGhi: ['btn-save', 'btn-save-draft'],
    coForm: false,
  },
  {
    ten: 'Vụ việc',
    mo: async () => {
      const { IncidentFormPage } = await import('@/pages/incidents/IncidentFormPage');
      return dung('/vu-viec/:id/edit', '/vu-viec/x1/edit', <IncidentFormPage />);
    },
    nutGhi: ['btn-save-top', 'btn-save'],
    coForm: true,
  },
  {
    ten: 'Đơn thư',
    mo: async () => {
      const { PetitionFormPage } = await import('@/pages/petitions/PetitionFormPage');
      return dung('/petitions/:id/edit', '/petitions/x1/edit', <PetitionFormPage />);
    },
    nutGhi: ['btn-save-top-main', 'btn-save-main', 'btn-convert-petition'],
    coForm: true,
  },
];

describe.each(FORM)('Form sửa $ten — chỉ xem', ({ mo, nutGhi, coForm }) => {
  beforeEach(() => {
    vi.mocked(api.put).mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('quyenGhi = false → có dải "Chỉ xem", không còn nút ghi, gửi form không gọi máy chủ', async () => {
    quyenGhi = false;
    const { container } = await mo();
    expect(await screen.findByTestId('bang-chi-xem', {}, { timeout: 5000 })).toBeInTheDocument();
    for (const t of nutGhi) expect(screen.queryByTestId(t)).toBeNull();
    // F3 Xoá tắt; F2 Lưu không gọi máy chủ.
    expect(phimTat.canDelete).toBeFalsy();
    phimTat.onSave?.();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.put).not.toHaveBeenCalled();
    if (coForm) {
      fireEvent.submit(container.querySelector('form')!);
      await new Promise((r) => setTimeout(r, 50));
      expect(api.put).not.toHaveBeenCalled();
    }
  });

  it('quyenGhi = true → như trước: có nút Lưu, không có dải, F2 lưu thật (đối chứng cho ca trên)', async () => {
    quyenGhi = true;
    await mo();
    await waitFor(() => expect(screen.getByTestId(nutGhi[0])).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByTestId('bang-chi-xem')).toBeNull();
    phimTat.onSave?.();
    await waitFor(() => expect(api.put).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('thiếu trường (máy chủ cũ) → như trước', async () => {
    quyenGhi = undefined;
    await mo();
    await waitFor(() => expect(screen.getByTestId(nutGhi[0])).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByTestId('bang-chi-xem')).toBeNull();
  });
});
