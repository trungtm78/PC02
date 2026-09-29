import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { TabInfo } from '../tabs';
import { INITIAL_FORM_DATA, type CaseFormData } from '../types';
import { buildCreateCasePayload } from '../buildCreateCasePayload';

Element.prototype.scrollIntoView = vi.fn();

const { moTaoNhanh, permissionState } = vi.hoisted(() => ({
  moTaoNhanh: vi.fn(),
  permissionState: {
    createPetitions: false,
    editPetitions: false,
    createCases: true,
    editCases: false,
  },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: (resource: string) => resource === 'cases'
      ? permissionState.createCases
      : resource === 'petitions' && permissionState.createPetitions,
    canEdit: (resource: string) => resource === 'cases'
      ? permissionState.editCases
      : resource === 'petitions' && permissionState.editPetitions,
    permissions: [
      ...(permissionState.createPetitions ? ['write:Petition'] : []),
      ...(permissionState.createCases ? ['write:Case'] : []),
    ],
  }),
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: moTaoNhanh }),
}));

vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: (type?: string) => ({
    data: type === 'NGUON_DON'
      ? [{ value: 'Trực tiếp', label: 'Trực tiếp' }, { value: 'Bưu điện', label: 'Bưu điện' }]
      : type === 'DON_VI'
        ? [{ value: 'Công an TP. Hồ Chí Minh', label: 'Công an TP. Hồ Chí Minh' }]
        : [],
    isLoading: false,
  }),
}));

function Khung({ giaTri = {} }: { giaTri?: Partial<CaseFormData> }) {
  const [formData, setFormData] = useState<CaseFormData>({
    ...INITIAL_FORM_DATA,
    caseProvenance: 'UY_THAC_DIEU_TRA',
    utdt_donViGiao: 'PC01',
    ...giaTri,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <TabInfo formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors} />
      <output data-testid="gia-tri-don-vi">{formData.supervisingUnit}</output>
      <output data-testid="payload-don-vi">{String(buildCreateCasePayload(formData).donViGiaiQuyet ?? '')}</output>
    </>
  );
}

function hien(giaTri?: Partial<CaseFormData>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Khung giaTri={giaTri} />, { wrapper });
}

function chonNguon(ten: string) {
  fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
  fireEvent.click(screen.getByTestId(`field-nguonDon-option-${ten}`));
}

describe('Ủy thác điều tra — tương tác như Đơn thư', () => {
  it('cho phép cán bộ có quyền tạo Vụ án tạo nhanh đơn vị dù không có quyền tạo Đơn thư', () => {
    permissionState.createPetitions = false;
    permissionState.createCases = true;
    hien();
    fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
    expect(screen.getByTestId('field-supervisingUnit-create-new')).toBeInTheDocument();
  });

  it('ẩn tạo nhanh khi cán bộ không có quyền tạo hồ sơ liên quan', () => {
    permissionState.createPetitions = false;
    permissionState.createCases = false;
    try {
      hien();
      fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
      expect(screen.queryByTestId('field-supervisingUnit-create-new')).not.toBeInTheDocument();
    } finally {
      permissionState.createCases = true;
    }
  });

  it('cho phép tạo nhanh khi cập nhật hồ sơ với quyền sửa Vụ án', () => {
    permissionState.createCases = false;
    permissionState.editCases = true;
    try {
      hien();
      fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
      expect(screen.getByTestId('field-supervisingUnit-create-new')).toBeInTheDocument();
    } finally {
      permissionState.createCases = true;
      permissionState.editCases = false;
    }
  });

  it('chỉ bung nhóm định danh khi chọn Trực tiếp và giữ SĐT ngoài nhóm', () => {
    hien();
    const nhom = screen.getByTestId('nhom-dinh-danh-nguyen-don');
    expect(screen.queryByTestId('field-cccdCungCap')).not.toBeInTheDocument();
    expect(nhom.contains(screen.getByTestId('field-sdtCungCap'))).toBe(false);

    chonNguon('Trực tiếp');
    expect(screen.getByTestId('field-cccdCungCap')).toBeInTheDocument();
    expect(screen.getByTestId('field-ngayCapCccd')).toBeInTheDocument();

    chonNguon('Bưu điện');
    expect(screen.queryByTestId('field-cccdCungCap')).not.toBeInTheDocument();
  });

  it('mở sẵn nhóm cho CCCD của hồ sơ cũ dù nguồn không trực tiếp', () => {
    hien({ nguonDon: 'Bưu điện', cccdCungCap: '012345678901' });
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don')).toBeInTheDocument();
    expect(screen.getByTestId('field-cccdCungCap')).toHaveValue('012345678901');
  });

  it('đổi từ Trực tiếp sang Bưu điện không xóa CCCD vừa nhập', () => {
    hien();
    chonNguon('Trực tiếp');
    fireEvent.change(screen.getByTestId('field-cccdCungCap'), { target: { value: '012345678901' } });
    chonNguon('Bưu điện');
    expect(screen.getByTestId('field-cccdCungCap')).toHaveValue('012345678901');
  });

  it('chọn Đơn vị giải quyết từ danh mục và ghi đúng cột khi lưu', () => {
    hien();
    fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
    fireEvent.click(screen.getByTestId('field-supervisingUnit-option-Công an TP. Hồ Chí Minh'));
    expect(screen.getByTestId('gia-tri-don-vi')).toHaveTextContent('Công an TP. Hồ Chí Minh');
    expect(screen.getByTestId('payload-don-vi')).toHaveTextContent('Công an TP. Hồ Chí Minh');
  });

  it('tạo nhanh đơn vị mới và chọn ngay tên vừa tạo', () => {
    moTaoNhanh.mockClear();
    hien();
    fireEvent.click(screen.getByTestId('field-supervisingUnit-trigger'));
    fireEvent.click(screen.getByTestId('field-supervisingUnit-create-new'));
    const yeuCau = moTaoNhanh.mock.calls[0]?.[0];
    expect(yeuCau.type).toBe('DON_VI');
    act(() => yeuCau.onCreated('Đơn vị mới'));
    expect(screen.getByTestId('gia-tri-don-vi')).toHaveTextContent('Đơn vị mới');
  });

  it('hiện tên đơn vị cũ ngoài trang danh mục và chỉ có một ô sửa', () => {
    hien({ supervisingUnit: 'Đội 4' });
    expect(screen.getByTestId('field-supervisingUnit-trigger')).toHaveTextContent('Đội 4');
    expect(screen.queryByText('Đơn vị thụ lý')).not.toBeInTheDocument();
  });

  it('form Vụ án thường giữ bố cục hiện tại', () => {
    hien({ caseProvenance: 'DIRECT_DISCOVERY' });
    expect(screen.queryByTestId('nhom-dinh-danh-nguyen-don')).not.toBeInTheDocument();
    expect(screen.getByText('Đơn vị thụ lý')).toBeInTheDocument();
  });
});
