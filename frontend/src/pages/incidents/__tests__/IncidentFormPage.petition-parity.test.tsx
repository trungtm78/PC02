import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

Element.prototype.scrollIntoView = vi.fn();

const apiGet = vi.hoisted(() => vi.fn());
const openQuickCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: openQuickCreate }),
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn(() => new Promise(() => {})) },
}));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useFormDefaults', () => ({ useFormDefaults: () => ({ isLoaded: false }) }));

const currentUser: AuthUser = {
  id: 'u1', email: 'officer@example.test', username: 'officer', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

async function renderForm() {
  const { IncidentFormPage } = await import('../IncidentFormPage');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/vu-viec/new']}>
        <Routes><Route path="/vu-viec/new" element={<IncidentFormPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Incident form petition interaction parity', () => {
  beforeEach(() => {
    authStore.setProfile(currentUser);
    apiGet.mockReset();
    apiGet.mockImplementation((path: string) => {
      if (path.includes('type=NGUON_DON')) return Promise.resolve({ data: { data: [
        { id: 'n1', name: 'Bưu điện', code: 'ND1' },
        { id: 'n2', name: 'Trực tiếp', code: 'ND2' },
      ] } });
      if (path.includes('type=DON_VI')) return Promise.resolve({ data: { data: [
        { id: 'u1', name: 'PC02 - Phòng Cảnh sát', code: 'DV1' },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  afterEach(() => vi.clearAllMocks());

  it('uses searchable quick-create directory controls for source and resolving unit', async () => {
    await renderForm();

    expect(await screen.findByTestId('field-nguonDon-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('field-supervisingUnit-trigger')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
    await waitFor(() => expect(screen.getByTestId('field-supervisingUnit-option-PC02 - Phòng Cảnh sát')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('field-supervisingUnit-search'), { target: { value: 'Đơn vị mới' } });
    fireEvent.click(await screen.findByTestId('field-supervisingUnit-create-new'));

    expect(openQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'DON_VI',
      tenGoiY: 'Đơn vị mới',
    }));
    const resolvingUnitRequest = openQuickCreate.mock.calls.at(-1)?.[0] as {
      onCreated: (name: string) => void;
    };
    act(() => resolvingUnitRequest.onCreated('Đơn vị vừa tạo'));
    await waitFor(() => expect(screen.getByTestId('field-supervisingUnit-trigger')).toHaveTextContent('Đơn vị vừa tạo'));
  });

  it('quick-creates and selects a new petition source', async () => {
    await renderForm();

    fireEvent.click(await screen.findByTestId('field-nguonDon-trigger'));
    fireEvent.change(screen.getByTestId('field-nguonDon-search'), { target: { value: 'Nguồn mới' } });
    fireEvent.click(await screen.findByTestId('field-nguonDon-create-new'));

    expect(openQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'NGUON_DON',
      tenGoiY: 'Nguồn mới',
    }));
    const sourceRequest = openQuickCreate.mock.calls.at(-1)?.[0] as {
      onCreated: (name: string) => void;
    };
    act(() => sourceRequest.onCreated('Nguồn vừa tạo'));
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toHaveTextContent('Nguồn vừa tạo'));
  });

  it('quick-creates the configurable information type and updates the reporter name', async () => {
    await renderForm();

    const reporter = await screen.findByTestId('field-benVu');
    fireEvent.change(reporter, { target: { value: 'Nguyễn Văn Báo Tin' } });
    expect(reporter).toHaveValue('Nguyễn Văn Báo Tin');

    fireEvent.click(screen.getByTestId('field-loaiThongTin-trigger'));
    fireEvent.change(screen.getByTestId('field-loaiThongTin-search'), { target: { value: 'Loại tin mới' } });
    fireEvent.click(await screen.findByTestId('field-loaiThongTin-create-new'));

    expect(openQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'LOAI_THONG_TIN',
      tenGoiY: 'Loại tin mới',
    }));
    const informationTypeRequest = openQuickCreate.mock.calls.at(-1)?.[0] as {
      onCreated: (name: string) => void;
    };
    act(() => informationTypeRequest.onCreated('Loại tin vừa tạo'));
    await waitFor(() => expect(screen.getByTestId('field-loaiThongTin-trigger')).toHaveTextContent('Loại tin vừa tạo'));
  });

  it('opens the four-field identity group for direct source and keeps phone outside', async () => {
    await renderForm();
    await screen.findByTestId('field-nguonDon-trigger');

    expect(screen.queryByTestId('field-cmndNguoiToGiac')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(await screen.findByTestId('field-nguonDon-option-Trực tiếp'));

    expect(await screen.findByTestId('field-cmndNguoiToGiac')).toBeInTheDocument();
    const group = screen.getByTestId('nhom-dinh-danh-nguoi-cung-cap');
    expect(group.contains(screen.getByTestId('field-sdtNguoiToGiac'))).toBe(false);
  });
});
