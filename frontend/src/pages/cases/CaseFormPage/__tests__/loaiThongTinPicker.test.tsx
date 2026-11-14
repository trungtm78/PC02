import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { CheDoXemProvider } from '@/components/form/CheDoXem';
import { TabInfo, TabUyThac } from '../tabs';
import { INITIAL_FORM_DATA, type CaseFormData } from '../types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));
import { buildCreateCasePayload } from '../buildCreateCasePayload';

Element.prototype.scrollIntoView = vi.fn();

const CATALOGUE_NAME = 'Tố giác';
const LEGACY_VALUE = 'Tin báo ghi tay từ hệ cũ';

const { openQuickCreate, requestedTypes, permissionState } = vi.hoisted(() => ({
  openQuickCreate: vi.fn(),
  requestedTypes: [] as string[],
  permissionState: { createCases: true },
}));

vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: (type?: string) => {
    if (type) requestedTypes.push(type);
    return {
      data: type === 'LOAI_THONG_TIN'
        ? [{ value: 'Tố giác', label: 'Tố giác' }, { value: 'Tin báo', label: 'Tin báo' }]
        : [],
      isLoading: false,
    };
  },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: openQuickCreate }),
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    permissions: [],
    canCreate: (resource: string) => resource === 'cases' && permissionState.createCases,
    canEdit: () => false,
  }),
}));

type TabName = 'info' | 'uy-thac';
type Lock = 'none' | 'view-mode' | 'fieldset';

/**
 * Mirrors how CaseFormPage mounts a tab: one shared form state, and the payload is built from
 * that same state, so what the picker writes is what the server would receive.
 */
function Harness({ tab, initial = {}, lock = 'none' }: {
  tab: TabName;
  initial?: Partial<CaseFormData>;
  lock?: Lock;
}) {
  const [formData, setFormData] = useState<CaseFormData>({
    ...INITIAL_FORM_DATA,
    ...(tab === 'uy-thac' ? { caseProvenance: 'UY_THAC_DIEU_TRA', utdt_donViGiao: 'PC01' } : {}),
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const Tab = tab === 'info' ? TabInfo : TabUyThac;
  const body = <Tab formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors} />;
  return (
    <>
      {lock === 'fieldset' ? <fieldset disabled>{body}</fieldset> : (
        <CheDoXemProvider xem={lock === 'view-mode'}>{body}</CheDoXemProvider>
      )}
      <output data-testid="payload-loaiThongTin">
        {String(buildCreateCasePayload(formData).loaiThongTin ?? '')}
      </output>
    </>
  );
}

function show(props: Parameters<typeof Harness>[0]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Harness {...props} />, { wrapper });
}

const trigger = () => screen.getByTestId('field-loaiThongTin-trigger');
const payload = () => screen.getByTestId('payload-loaiThongTin').textContent;

beforeEach(() => {
  openQuickCreate.mockClear();
  requestedTypes.length = 0;
  permissionState.createCases = true;
});

describe.each<TabName>(['info', 'uy-thac'])('Case form, tab "%s": Loai thong tin is a catalogue picker', (tab) => {
  it('renders the LOAI_THONG_TIN picker instead of a plain text box', () => {
    show({ tab });
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(requestedTypes).toContain('LOAI_THONG_TIN');
    expect(screen.queryByRole('textbox', { name: 'Loại thông tin' })).not.toBeInTheDocument();
  });

  it('puts the NAME of the chosen entry in the payload', () => {
    show({ tab });
    expect(payload()).toBe('');
    fireEvent.click(trigger());
    fireEvent.click(screen.getByTestId(`field-loaiThongTin-option-${CATALOGUE_NAME}`));
    expect(trigger()).toHaveTextContent(CATALOGUE_NAME);
    expect(payload()).toBe(CATALOGUE_NAME);
  });

  it('shows a stored value that is not in the catalogue and keeps it through an untouched save', () => {
    show({ tab, initial: { loaiThongTin: LEGACY_VALUE } });
    expect(trigger()).toHaveTextContent(LEGACY_VALUE);
    expect(payload()).toBe(LEGACY_VALUE);
  });

  it('keeps the stored legacy value when the list is opened and closed without choosing', () => {
    show({ tab, initial: { loaiThongTin: LEGACY_VALUE } });
    fireEvent.click(trigger());
    // The stored value is offered in the list, so it can be re-chosen after browsing.
    expect(screen.getByTestId(`field-loaiThongTin-option-${LEGACY_VALUE}`)).toBeInTheDocument();
    fireEvent.click(trigger());
    expect(screen.queryByTestId('field-loaiThongTin-dropdown')).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent(LEGACY_VALUE);
    expect(payload()).toBe(LEGACY_VALUE);
  });

  it('quick-creates a catalogue entry and selects the created name', () => {
    show({ tab });
    fireEvent.click(trigger());
    fireEvent.change(screen.getByTestId('field-loaiThongTin-search'), { target: { value: 'Loại tin mới' } });
    fireEvent.click(screen.getByTestId('field-loaiThongTin-create-new'));
    expect(openQuickCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOAI_THONG_TIN', tenGoiY: 'Loại tin mới' }),
    );
    const request = openQuickCreate.mock.calls.at(-1)?.[0] as { onCreated: (name: string) => void };
    act(() => request.onCreated('Loại tin vừa tạo'));
    expect(trigger()).toHaveTextContent('Loại tin vừa tạo');
    expect(payload()).toBe('Loại tin vừa tạo');
  });

  it('hides quick creation without write permission on the related records', () => {
    permissionState.createCases = false;
    show({ tab });
    fireEvent.click(trigger());
    expect(screen.queryByTestId('field-loaiThongTin-create-new')).not.toBeInTheDocument();
  });

  it('cannot be opened or cleared in view mode', () => {
    show({ tab, initial: { loaiThongTin: CATALOGUE_NAME }, lock: 'view-mode' });
    expect(trigger()).toHaveAttribute('aria-disabled', 'true');
    expect(trigger()).toHaveTextContent(CATALOGUE_NAME);
    fireEvent.click(trigger());
    expect(screen.queryByTestId('field-loaiThongTin-dropdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-loaiThongTin-clear')).not.toBeInTheDocument();
    expect(payload()).toBe(CATALOGUE_NAME);
  });

  /**
   * CaseFormPage locks a read-only record with `<fieldset disabled>`. The trigger is a div, so
   * the list still opens, but every control that could change the value is a disabled control.
   */
  it('offers no enabled control that changes the value inside a disabled fieldset', () => {
    show({ tab, initial: { loaiThongTin: CATALOGUE_NAME }, lock: 'fieldset' });
    expect(screen.getByTestId('field-loaiThongTin-clear')).toBeDisabled();
    fireEvent.click(trigger());
    expect(screen.getByTestId('field-loaiThongTin-option-Tin báo')).toBeDisabled();
    expect(screen.getByTestId('field-loaiThongTin-search')).toBeDisabled();
    expect(screen.getByTestId('field-loaiThongTin-create-new')).toBeDisabled();
    expect(payload()).toBe(CATALOGUE_NAME);
  });
});
