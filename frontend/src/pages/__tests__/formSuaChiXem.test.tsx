/**
 * Form SỬA Vụ án / Vụ việc / Đơn thư khi người mở CHỈ ĐỌC được hồ sơ (vd điều phối viên mở hồ sơ tổ khác, hoặc gõ
 * thẳng URL `/…/:id/edit`): trước đây form mở như thường, cán bộ nhập xong bấm Lưu mới nhận 403 — mất công nhập.
 * Nay máy chủ trả `quyenGhi` (#439, #440, 20/09/2026): form vẫn cho XEM đủ (Đơn thư không có trang xem riêng), nhưng
 * báo "Chỉ xem" ngay đầu trang, ẩn mọi nút ghi, và đường gửi form (Enter / phím tắt) cũng không gọi máy chủ.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { forwardRef, useImperativeHandle, type ReactElement } from 'react';
import { api } from '@/lib/api';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { AssignModalContext, type AssignModalArgs } from '@/features/_shared/modals/AssignModalContext';

let quyenGhi: boolean | undefined;
const moPhanCong = vi.fn<(args: AssignModalArgs) => void>();
beforeAll(() => vi.stubGlobal('alert', vi.fn()));
afterAll(() => vi.unstubAllGlobals());
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
      if (url.endsWith('/field-schema')) return Promise.resolve({ data: { data: null } });
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
              status: 'TIEP_NHAN',
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
vi.mock('@/components/inputs/RecordDuplicateReview', () => ({
  RecordDuplicateReview: forwardRef(({ name }: { name?: string }, ref) => {
    useImperativeHandle(ref, () => ({
      verify: async () => ({ ok: true, acknowledgedIds: [] }),
    }));
    return <div data-testid="mock-duplicate-name" data-name={name ?? ''} />;
  }),
}));
vi.mock('@/components/inputs/RecordNameSuggestions', () => ({
  RecordNameSuggestions: () => null,
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

async function dung(path: string, url: string, trang: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <QueryClientProvider client={qc}>
        <AssignModalContext.Provider value={{ open: moPhanCong }}>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path={path} element={trang} />
              <Route path="*" element={<div>Đích điều hướng</div>} />
            </Routes>
          </MemoryRouter>
        </AssignModalContext.Provider>
      </QueryClientProvider>,
    );
    await Promise.resolve();
  });
  return result!;
}

const FORM = [
  {
    ten: 'Vụ án',
    mo: async () => {
      const { default: CaseFormPage } = await import('@/pages/cases/CaseFormPage');
      return dung('/cases/:id/edit', '/cases/x1/edit', <CaseFormPage />);
    },
    nutGhi: ['btn-save', 'btn-save-caret'],
    coForm: false,
    xacNhan: undefined,
  },
  {
    ten: 'Vụ việc',
    mo: async () => {
      const { IncidentFormPage } = await import('@/pages/incidents/IncidentFormPage');
      return dung('/vu-viec/:id/edit', '/vu-viec/x1/edit', <IncidentFormPage />);
    },
    nutGhi: ['btn-save-top', 'btn-save'],
    coForm: true,
    xacNhan: undefined,
  },
  {
    ten: 'Đơn thư',
    mo: async () => {
      const { PetitionFormPage } = await import('@/pages/petitions/PetitionFormPage');
      return dung('/petitions/:id/edit', '/petitions/x1/edit', <PetitionFormPage />);
    },
    nutGhi: ['btn-save-top-main', 'btn-save-main', 'btn-convert-petition', 'section-phan-cong'],
    coForm: true,
    xacNhan: undefined,
  },
];

describe.each(FORM)('Form sửa $ten — chỉ xem', ({ mo, nutGhi, coForm, xacNhan }) => {
  beforeEach(() => {
    vi.mocked(api.put).mockClear();
    moPhanCong.mockClear();
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
    await act(async () => {
      phimTat.onSave?.();
      await Promise.resolve();
    });
    expect(api.put).not.toHaveBeenCalled();
    if (coForm) {
      fireEvent.submit(container.querySelector('form')!);
      await act(async () => Promise.resolve());
      expect(api.put).not.toHaveBeenCalled();
    }
  });

  it('quyenGhi = true → như trước: có nút Lưu, không có dải, F2 lưu thật (đối chứng cho ca trên)', async () => {
    quyenGhi = true;
    await mo();
    await waitFor(() => expect(screen.getByTestId(nutGhi[0])).not.toBeDisabled(), { timeout: 5000 });
    if (nutGhi[0] === 'btn-save') {
      await waitFor(() => {
        expect(screen.getByTestId('mock-duplicate-name')).toHaveAttribute('data-name', 'Hồ sơ thử');
      }, { timeout: 5000 });
    }
    expect(screen.queryByTestId('bang-chi-xem')).toBeNull();
    await act(async () => {
      phimTat.onSave?.();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('form-error-summary')).toBeNull();
    if (xacNhan) {
      fireEvent.click(await screen.findByRole('button', { name: xacNhan }));
    }
    await waitFor(() => expect(api.put).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('thiếu trường (máy chủ cũ) → như trước', async () => {
    quyenGhi = undefined;
    await mo();
    await waitFor(() => expect(screen.getByTestId(nutGhi[0])).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByTestId('bang-chi-xem')).toBeNull();
  });
});

describe('Form sửa Đơn thư — điều phối viên chỉ xem vẫn phân công được', () => {
  it('quyenGhi = false + điều phối → còn khối Phân công, không có nút Lưu', async () => {
    sessionStorage.clear();
    authStore.setProfile({ id: 'dp', email: 'dp@x', username: 'dp', role: 'OFFICER', canDispatch: true } as AuthUser);
    quyenGhi = false;
    await FORM[2].mo();
    expect(await screen.findByTestId('bang-chi-xem', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('section-phan-cong')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-save-main')).toBeNull();
    sessionStorage.clear();
  });
});

describe('Form sửa Vụ việc — phân công không làm mất dữ liệu chưa lưu', () => {
  it('điều phối viên chỉ xem vẫn mở được lệnh phân công', async () => {
    authStore.setProfile({ id: 'dp', email: 'dp@x', username: 'dp', role: 'OFFICER', canDispatch: true } as AuthUser);
    quyenGhi = false;
    await FORM[1].mo();
    const button = await screen.findByTestId('btn-assign-incident-form', {}, { timeout: 5000 });
    expect(button).not.toBeDisabled();
  });

  it('cập nhật kết quả phân công tại chỗ và giữ nguyên ô người dùng đang sửa', async () => {
    authStore.setProfile({ id: 'dp', email: 'dp@x', username: 'dp', role: 'OFFICER', canDispatch: true } as AuthUser);
    quyenGhi = true;
    await FORM[1].mo();
    const name = await screen.findByTestId('field-name', {}, { timeout: 5000 });
    fireEvent.change(name, { target: { value: 'Nội dung chưa lưu' } });
    fireEvent.click(screen.getByTestId('btn-assign-incident-form'));
    const args = moPhanCong.mock.calls[0]?.[0];
    expect(args).toBeDefined();

    await act(async () => {
      args?.onSuccess?.({ data: { assignedTeamId: 'team-2', investigatorId: 'u2', updatedAt: '2026-09-29T12:00:00Z' } });
    });

    expect(screen.getByTestId('field-name')).toHaveValue('Nội dung chưa lưu');
  });
});

describe('Form xem Vụ việc dùng chung form tạo/sửa', () => {
  it('readOnly khóa trường nhập nhưng vẫn cho chuyển tab và tạo mới từ hồ sơ này', async () => {
    authStore.setProfile({ id: 'admin', email: 'admin@x', username: 'admin', role: 'ADMIN' } as AuthUser);
    quyenGhi = true;
    const { IncidentFormPage } = await import('@/pages/incidents/IncidentFormPage');
    await dung('/vu-viec/:id', '/vu-viec/x1', <IncidentFormPage readOnly />);

    const name = await screen.findByTestId('field-name', {}, { timeout: 5000 });
    expect(name).toBeDisabled();
    expect(screen.getByTestId('btn-edit-incident')).toBeInTheDocument();
    expect(screen.getByTestId('btn-clone-incident')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-save-top')).toBeNull();
    expect(screen.getByTestId('incident-current-status')).toBeInTheDocument();

    const identityToggle = screen.getByTestId('nhom-dinh-danh-nguoi-cung-cap-nut');
    expect(identityToggle).not.toBeDisabled();
    fireEvent.click(identityToggle);
    expect(screen.getByTestId('field-cmndNguoiToGiac')).toBeDisabled();

    fireEvent.click(screen.getByTestId('tab-nut-case'));
    expect(screen.getByTestId('tab-case')).toBeInTheDocument();
  });
});
