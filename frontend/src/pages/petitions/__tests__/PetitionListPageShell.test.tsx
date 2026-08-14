/**
 * Integration test for PetitionListPageShell (PR2/T5).
 *
 * Mirror Cases + Incidents shell test patterns. Petition has no phase tabs
 * (single workflow), so coverage simpler than Incidents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { useListShortcuts } from '@/hooks/useListShortcuts';
import { PetitionListPageShell } from '../PetitionListPageShell';
import { PetitionStatus } from '@/shared/enums/generated';
import { AssignModalProvider } from '@/features/_shared/modals/AssignModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// `vi.mock` is hoisted above ordinary declarations, so the mutable the mocked
// store reads has to be hoisted with it. Tests flip `auth.granted` to check
// both sides of the permission gate.
const auth = vi.hoisted(() => ({
  granted: [{ action: 'read', subject: 'Petition' },
          { action: 'write', subject: 'Petition' },
          { action: 'edit', subject: 'Petition' },
          { action: 'delete', subject: 'Petition' },] as { action: string; subject: string }[] | null,
}));
const FULL_PERMISSIONS = auth.granted;

// The permission layer is real now: with no auth store the shell sees no user,
// so "Tạo mới", the Alt+N shortcut and the empty-state CTA are all correctly
// hidden. This test covers the case of a user who may create.
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(() => auth.granted === null
      ? null
      : { email: 'officer@test.local', role: 'OFFICER', permissions: auth.granted }),
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/hooks/useListShortcuts', () => ({
  useListShortcuts: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/petitions']) {
  let lastLocation = '';
  function LocationTracker() {
    const loc = useLocation();
    lastLocation = loc.pathname + loc.search;
    return null;
  }
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={initialEntries}>
      <AssignModalProvider>
        <DeleteResourceModalProvider>
          <Routes>
            <Route path="/petitions" element={<><PetitionListPageShell /><LocationTracker /></>} />
            <Route path="/petitions/new" element={<div>NewPetitionPage</div>} />
            <Route path="/petitions/:id" element={<div>PetitionDetailPage</div>} />
          </Routes>
        </DeleteResourceModalProvider>
      </AssignModalProvider>
    </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, getLocation: () => lastLocation };
}

const sampleRow = {
  id: 'petition-1',
  stt: 'DT-2026-00001',
  receivedDate: '2026-05-15T00:00:00Z',
  unit: 'PC02',
  senderName: 'Nguyễn Văn A',
  suspectedPerson: 'Trần Văn B',
  status: 'MOI_TIEP_NHAN' as PetitionStatus,
  deadline: '2026-06-30T00:00:00Z',
  createdAt: '2026-05-15T00:00:00Z',
};

// Exhaustive byStatus — 7 PetitionStatus keys.
const exhaustiveByStatus: Record<PetitionStatus, number> = {
  MOI_TIEP_NHAN: 8,
  DANG_XU_LY: 15,
  CHO_PHE_DUYET: 2,
  DA_LUU_DON: 1,
  DA_GIAI_QUYET: 4,
  DA_CHUYEN_VU_VIEC: 3,
  DA_CHUYEN_VU_AN: 1,
};

// byGroup do SERVER đếm (PETITION_STATUS_GROUPS). Thiếu field này thì thẻ nhóm render
// khung xương vĩnh viễn — fixture phải có, không thì test "xanh giả".
const sampleStats = {
  total: 34,
  byStatus: exhaustiveByStatus,
  byGroup: {
    'moi-tiep-nhan': 8,
    'dang-xu-ly': 17, // DANG_XU_LY 15 + CHO_PHE_DUYET 2
    'da-giai-quyet': 8, // 4 + 3 + 1
    'da-luu-don': 1,
  },
};

describe('PetitionListPageShell — initial mount + ready state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') {
        return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      }
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  it('mount → skeleton → ready với 1 row', async () => {
    renderWithRouter();
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('list-page-shell-table-loading')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('DT-2026-00001')).toBeInTheDocument();
  });

  it('header render "Danh sách đơn thư" title', () => {
    renderWithRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: /Danh sách đơn thư/i }),
    ).toBeInTheDocument();
  });

  it('StatusChips render 7 PetitionStatus + "Tất cả" = 8 chips', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    expect(screen.getAllByRole('tab')).toHaveLength(8);
  });

  it('StatusChips render server counts', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const chipBar = screen.getByRole('tablist', { name: /lọc theo trạng thái/i });
    expect(within(chipBar).getByText('34')).toBeInTheDocument(); // total
    expect(within(chipBar).getByText('15')).toBeInTheDocument(); // DANG_XU_LY
  });
});

describe('PetitionListPageShell — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('click status chip → URL state cập nhật với petitions_ prefix', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const dangXuLy = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Đang xử lý'));
    expect(dangXuLy).toBeDefined();
    fireEvent.click(dangXuLy!);
    await waitFor(() => {
      expect(getLocation()).toContain('petitions_status=DANG_XU_LY');
      expect(getLocation()).toContain('petitions_page=1');
    });
  });

  it('row click → navigate detail', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    await waitFor(() => expect(screen.getByText('PetitionDetailPage')).toBeInTheDocument());
  });

  it('"Tạo mới" → /petitions/new', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    fireEvent.click(screen.getByRole('button', { name: /Tạo mới/i }));
    await waitFor(() => expect(screen.getByText('NewPetitionPage')).toBeInTheDocument());
  });
});

describe('PetitionListPageShell — empty + error states', () => {
  it('state=empty → render CTA "Tạo đơn thư mới"', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/petitions/stats') {
        return Promise.resolve({ data: { total: 0, byStatus: exhaustiveByStatus } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Tạo đơn thư mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered (status active) → filtered empty', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter(['/petitions?petitions_status=DANG_XU_LY']);
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });

  it('state=error (500) → Vietnamese message', async () => {
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: {} },
    });
    (api.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Lỗi máy chủ/i)).toBeInTheDocument();
  });
});

describe('PetitionListPageShell — security + URL load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('malformed status URL param → ignore', async () => {
    renderWithRouter(['/petitions?petitions_status=__proto__']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/petitions', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.status).toBeUndefined();
  });

  it('byStatus response exhaustive — mọi PetitionStatus key có number', () => {
    Object.values(PetitionStatus).forEach((status) => {
      expect(typeof exhaustiveByStatus[status]).toBe('number');
    });
  });

  it('load với petitions_status filter → fetch với status', async () => {
    renderWithRouter(['/petitions?petitions_status=DA_GIAI_QUYET']);
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.status).toBe('DA_GIAI_QUYET');
  });

  it('load với petitions_page=2 → fetch offset=20', async () => {
    renderWithRouter(['/petitions?petitions_page=2']);
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.offset).toBe(20);
  });
});

/**
 * Drill-down: bấm thẻ thống kê để lọc danh sách.
 *
 * Thẻ gộp nhiều trạng thái ("Đang xử lý" = DANG_XU_LY + CHO_PHE_DUYET) nên gửi KEY nhóm
 * (`statusGroup`) lên server, không gửi từng trạng thái.
 */
describe('PetitionListPageShell — drill-down thẻ thống kê', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  /**
   * Nhãn như "Đang xử lý" có ở CẢ thẻ thống kê lẫn chip trạng thái. Thẻ là <button> thường,
   * chip là <button role="tab"> → lọc theo đó để nhắm đúng thẻ.
   */
  const cardButton = (label: string) => {
    const btn = screen
      .getAllByText(label)
      .map((el) => el.closest('button'))
      .find((b): b is HTMLButtonElement => b != null && b.getAttribute('role') !== 'tab');
    if (!btn) throw new Error(`Không tìm thấy thẻ thống kê "${label}"`);
    return btn;
  };

  it('thẻ hiển thị số từ byGroup của server (không cộng tay ở client)', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('17')).toBeInTheDocument()); // Đang xử lý
    expect(within(cardButton('Đã giải quyết')).getByText('8')).toBeInTheDocument();
  });

  it('bấm thẻ → URL có statusGroup, page về 1, request gửi statusGroup KHÔNG gửi status', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_page=3']);
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));

    fireEvent.click(cardButton('Đang xử lý'));

    await waitFor(() => expect(getLocation()).toContain('petitions_statusGroup=dang-xu-ly'));
    expect(getLocation()).toContain('petitions_page=1');

    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      const last = calls[calls.length - 1];
      expect(last?.[1]?.params.statusGroup).toBe('dang-xu-ly');
      expect(last?.[1]?.params.status).toBeUndefined();
    });
  });

  it('bấm thẻ "Tổng" → xoá lọc nhóm', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    await waitFor(() => expect(screen.getAllByText('Tổng đơn thư').length).toBeGreaterThan(0));

    fireEvent.click(cardButton('Tổng đơn thư'));

    await waitFor(() => expect(getLocation()).not.toContain('petitions_statusGroup'));
  });

  it('thẻ đang chọn KHÔNG bấm được (anh chốt) — không phát sinh request mới', async () => {
    renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));
    const before = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    const active = cardButton('Đang xử lý');
    expect(active).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(active);

    expect((api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('chọn chip trạng thái → xoá nhóm đang lọc (hai control loại trừ nhau)', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    const chipBar = await screen.findByRole('tablist');
    const chip = within(chipBar)
      .getAllByRole('tab')
      .find((t) => t.textContent?.includes('Lưu đơn'))!;

    fireEvent.click(chip);

    await waitFor(() => expect(getLocation()).not.toContain('petitions_statusGroup'));
  });

  /** Bấm thẻ chỉ được bắn lại DANH SÁCH — bắn lại stats sẽ nháy khung xương mỗi lần bấm. */
  it('bấm thẻ KHÔNG gọi lại /petitions/stats', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));
    const statsBefore = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === '/petitions/stats',
    ).length;

    fireEvent.click(cardButton('Đang xử lý'));

    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      expect(calls[calls.length - 1]?.[1]?.params.statusGroup).toBe('dang-xu-ly');
    });
    const statsAfter = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === '/petitions/stats',
    ).length;
    expect(statsAfter).toBe(statsBefore);
  });

  /**
   * REGRESSION #2: trước đây gửi `sender` (DTO chỉ có `senderName`) và `advancedStatus`
   * (DTO không có) → forbidNonWhitelisted trả 400, bộ lọc nâng cao gãy.
   */
  it('KHÔNG gửi param lạ khiến backend trả 400 (sender/advancedStatus)', async () => {
    renderWithRouter(['/petitions?petitions_sender=Nguyen']);
    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      expect(calls.length).toBeGreaterThan(0);
      const p = calls[calls.length - 1]?.[1]?.params ?? {};
      expect(p.sender).toBeUndefined();
      expect(p.advancedStatus).toBeUndefined();
      expect(p.senderName).toBe('Nguyen');
    });
  });

  /** REGRESSION #1: stats phải nhận cùng bộ lọc với danh sách, nếu không số thẻ lệch. */
  it('stats nhận CÙNG bộ lọc nâng cao với danh sách', async () => {
    renderWithRouter(['/petitions?petitions_sender=Nguyen']);
    await waitFor(() => {
      const statsCalls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions/stats',
      );
      expect(statsCalls[statsCalls.length - 1]?.[1]?.params.senderName).toBe('Nguyen');
    });
  });
});


/**
 * PR-F1 gated three entry points on the same `write` grant: the header button,
 * the Alt+N shortcut and the empty-state CTA. Asserting the granted case only
 * would have passed just as well before the gate existed, so this asserts the
 * denied case — the one the change is actually for.
 */
describe('PetitionListPageShell — a user who may not create', () => {
  beforeEach(() => {
    auth.granted = [{ action: 'read', subject: 'Petition' }];
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {}, byGroup: {} } });
      return Promise.resolve({ data: { data: [], total: 0, page: 1, limit: 20 } });
    });
  });

  afterEach(() => {
    auth.granted = FULL_PERMISSIONS;
  });

  it('hides the header create button', async () => {
    renderWithRouter();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByTestId('btn-create-petition')).not.toBeInTheDocument();
  });

  it('hides the empty-state call to action', async () => {
    renderWithRouter();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByText('Tạo đơn thư mới')).not.toBeInTheDocument();
  });

  it('hands the Alt+N shortcut no handler, which unregisters it', () => {
    // The three doors this gate covers are the button, the empty-state CTA and
    // Alt+N. The first two are assertable by absence in the DOM; the shortcut
    // is not rendered, and pressing it in jsdom does not reach
    // react-hotkeys-hook, so a keyboard test here would pass whether or not
    // the gate existed — it would assert nothing. The contract that IS
    // checkable is the one this file owns: the shell passes no `onNew`.
    // `useListShortcuts` already has its own test proving an absent `onNew`
    // leaves `newRecord` disabled.
    renderWithRouter();

    const call = vi.mocked(useListShortcuts).mock.calls.at(-1)?.[0];
    expect(call?.onNew).toBeUndefined();
  });
});
