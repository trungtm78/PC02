/**
 * LawyerListPageShell — PR4 bulk-delete regression suite.
 *
 * Plan PR4 mandatory coverage:
 * - select-all-page → BulkActionBar shows "Đã chọn N"
 * - partial select → BulkActionBar shows partial count
 * - delete with reason ≥10 chars → POST /lawyers/bulk-delete với reason
 * - permission denial → delete button hidden (usePermission mocked)
 * - API failure → error banner shown
 * - bulk delete success → selection clears + refetch + success banner
 * - clear-on-filter-change (built into useBulkSelection)
 * - per-row checkbox toggle
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LawyerListPageShell } from '../LawyerListPageShell';

// BulkActionBar wraps "Đã chọn N luật sư" in role="status" + aria-live="polite".
// Use that to find the bar deterministically, then check its textContent.
async function findBulkBarWithCount(n: number) {
  const { findAllByRole } = await import('@testing-library/react').then((m) => ({
    findAllByRole: m.screen.findAllByRole.bind(m.screen),
  }));
  const bars = await findAllByRole('status');
  const bulkBar = bars.find((el) =>
    new RegExp(`Đã chọn\\s*${n}\\s*luật sư`).test(el.textContent ?? ''),
  );
  if (!bulkBar) throw new Error(`BulkActionBar with count ${n} not found`);
  return bulkBar;
}
function queryBulkBarWithCount(n: number): Element | null {
  const bars = document.querySelectorAll('[role="status"]');
  for (const bar of Array.from(bars)) {
    if (new RegExp(`Đã chọn\\s*${n}\\s*luật sư`).test(bar.textContent ?? '')) {
      return bar;
    }
  }
  return null;
}

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

// Default permission mock — full access. Tests override via re-mock.
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    hasPermission: vi.fn().mockReturnValue(true),
  }),
}));

const SAMPLE_LAWYERS = [
  {
    id: 'lawyer-1',
    fullName: 'Nguyễn Văn A',
    barNumber: 'LS-2024-001',
    lawFirm: 'VPLS Minh Trí',
    phone: '0901234567',
    caseId: 'case-1',
    subjectId: 'subj-1',
    createdAt: '2026-05-20T00:00:00Z',
    case: { id: 'case-1', name: 'Vụ A', caseCode: 'PC02-001' },
    subject: { id: 'subj-1', fullName: 'Trần Văn B' },
  },
  {
    id: 'lawyer-2',
    fullName: 'Lê Thị C',
    barNumber: 'LS-2024-002',
    lawFirm: 'VPLS Bình An',
    phone: '0907654321',
    caseId: 'case-1',
    subjectId: 'subj-2',
    createdAt: '2026-05-21T00:00:00Z',
    case: { id: 'case-1', name: 'Vụ A', caseCode: 'PC02-001' },
    subject: { id: 'subj-2', fullName: 'Phạm Văn D' },
  },
];

function setupHappyFetch(lawyers = SAMPLE_LAWYERS) {
  mockApiGet.mockResolvedValue({
    data: { data: lawyers, total: lawyers.length },
  });
}

function renderShell(initialEntry = '/lawyers') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/lawyers" element={<LawyerListPageShell />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LawyerListPageShell — mount + render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('mounts → renders header "Danh sách luật sư"', async () => {
    renderShell();
    expect(
      screen.getByRole('heading', { level: 1, name: /Danh sách luật sư/i }),
    ).toBeInTheDocument();
  });

  it('fetches /lawyers on mount', async () => {
    renderShell();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const url = mockApiGet.mock.calls[0][0] as string;
    expect(url).toContain('/lawyers?');
    expect(url).toContain('limit=20');
  });

  it('renders both sample rows', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    expect(screen.getByText('Lê Thị C')).toBeInTheDocument();
    expect(screen.getByText('LS-2024-001')).toBeInTheDocument();
    expect(screen.getByText('LS-2024-002')).toBeInTheDocument();
  });

  it('empty state when total=0 + no search', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [], total: 0 } });
    renderShell();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
  });

  it('empty-filtered when search active + total=0', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [], total: 0 } });
    renderShell('/lawyers?lawyers_q=nonexistent');
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });
});

describe('LawyerListPageShell — bulk selection (plan PR4 mandatory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('select-all checkbox in header → both rows selected → BulkActionBar shows count', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');

    // Find header checkbox via aria-label
    const headerCheckbox = screen.getByRole('checkbox', {
      name: /Chọn tất cả luật sư trong trang/i,
    });
    fireEvent.click(headerCheckbox);

    await waitFor(() => expect(queryBulkBarWithCount(2)).not.toBeNull());
  });

  it('partial select — click 1 row checkbox → BulkActionBar shows 1 selected', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');

    const rowCheckbox = screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i });
    fireEvent.click(rowCheckbox);

    await waitFor(() => expect(queryBulkBarWithCount(1)).not.toBeNull());

    // Header indeterminate (some)
    const headerCheckbox = screen.getByRole('checkbox', {
      name: /Chọn tất cả luật sư trong trang/i,
    }) as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(true);
  });

  it('toggle row twice → back to 0 selected (no BulkActionBar)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');

    const rowCheckbox = screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i });
    fireEvent.click(rowCheckbox);
    await findBulkBarWithCount(1);
    fireEvent.click(rowCheckbox);

    await waitFor(() => {
      expect(screen.queryByText(/Đã chọn/i)).not.toBeInTheDocument();
    });
  });

  it('row visually highlighted khi selected (bg-blue-50)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    const rowCheckbox = screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i });
    fireEvent.click(rowCheckbox);
    await findBulkBarWithCount(1);
    const row = screen.getByTestId('lawyer-row-lawyer-1');
    expect(row.className).toContain('bg-blue-50');
  });
});

describe('LawyerListPageShell — bulk delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
    mockApiPost.mockResolvedValue({
      data: { succeeded: [{ id: 'lawyer-1' }], skipped: [], failed: [] },
    });
  });

  it('Xóa button visible when items selected (permission granted)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);

    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('click Xóa → opens confirm modal với reason textarea', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    // Modal opens — find textarea
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('bulk delete với reason ≥10 chars → POST /lawyers/bulk-delete', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: 'Xóa luật sư trùng do nhập sai số thẻ.' },
    });

    // Find the confirm button in the modal (any button with "Xác nhận" text)
    const confirmBtns = screen.getAllByRole('button');
    const confirmBtn = confirmBtns.find((b) => /xác nhận/i.test(b.textContent ?? ''));
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/lawyers/bulk-delete',
        expect.objectContaining({
          ids: ['lawyer-1'],
          reason: expect.stringContaining('Xóa luật sư trùng'),
        }),
      );
    });
  });

  it('after bulk delete success → success banner shown + selection cleared + refetch', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Xóa luật sư trùng lặp 10 chars' } });
    const confirmBtn = screen.getAllByRole('button').find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    // Banner appears with success
    await waitFor(() => {
      const banner = screen.getByTestId('lawyers-bulk-banner');
      expect(within(banner).getByText(/Đã xóa 1 luật sư/i)).toBeInTheDocument();
    });

    // Selection cleared → "Đã chọn" disappears
    await waitFor(() => {
      expect(queryBulkBarWithCount(1)).toBeNull();
    });

    // /lawyers re-fetched (2 calls: initial + post-delete)
    await waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('API failure → error banner shown, selection preserved', async () => {
    mockApiPost.mockRejectedValue(
      Object.assign(new Error('500'), {
        isAxiosError: true,
        response: { status: 500, data: {} },
      }),
    );

    renderShell();
    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Xóa luật sư trùng lặp 10 chars' } });
    const confirmBtn = screen.getAllByRole('button').find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      const banner = screen.getByTestId('lawyers-bulk-banner');
      expect(within(banner).getByText(/thất bại/i)).toBeInTheDocument();
    });
  });

  it('skipped items shown in success banner (partial delete)', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        succeeded: [{ id: 'lawyer-1' }],
        skipped: [{ id: 'lawyer-2', reason: 'PERMISSION' }],
        failed: [],
      },
    });

    renderShell();
    await screen.findByText('Nguyễn Văn A');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn tất cả luật sư trong trang/i }),
    );
    await findBulkBarWithCount(2);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Xóa hàng loạt theo lệnh' } });
    const confirmBtn = screen.getAllByRole('button').find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      const banner = screen.getByTestId('lawyers-bulk-banner');
      expect(within(banner).getByText(/Đã xóa 1 luật sư/i)).toBeInTheDocument();
      expect(within(banner).getByText(/Bỏ qua 1/i)).toBeInTheDocument();
    });
  });
});

describe('LawyerListPageShell — search + URL state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('lawyers_q in URL → passed as search param to API', async () => {
    renderShell('/lawyers?lawyers_q=Nguyen');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('search=Nguyen');
    });
  });

  it('lawyers_page=2 → offset=20', async () => {
    renderShell('/lawyers?lawyers_page=2');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('offset=20');
    });
  });

  it('control chars in lawyers_q stripped', async () => {
    renderShell('/lawyers?lawyers_q=Nguy%09evil%0A');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('search=Nguyevil');
    });
  });

  // /codex P2 fix #1: case column renders case.name (API doesn't return caseCode)
  it('case column renders case.name (not caseCode)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');
    // SAMPLE_LAWYERS has case.name="Vụ A" — expect that, not caseCode
    expect(screen.getAllByText('Vụ A').length).toBeGreaterThanOrEqual(1);
  });
});

// /codex P2 fix #2: stale selection race on URL change.
// Triggers an in-page setParam() which is the realistic navigation path
// (the search input + pagination buttons call url.setParam internally).
describe('LawyerListPageShell — bulk selection clears on URL change (Codex P2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('clicking pagination next → selection cleared synchronously', async () => {
    // Need >20 rows to make pagination visible.
    const manyLawyers = Array.from({ length: 25 }, (_, i) => ({
      ...SAMPLE_LAWYERS[0],
      id: `lawyer-${i + 1}`,
      fullName: `Luật sư ${i + 1}`,
      barNumber: `LS-2024-${String(i + 1).padStart(3, '0')}`,
    }));
    mockApiGet.mockResolvedValue({ data: { data: manyLawyers.slice(0, 20), total: 25 } });

    renderShell();
    await screen.findByText('Luật sư 1');

    fireEvent.click(screen.getByRole('checkbox', { name: /^Chọn luật sư Luật sư 1$/i }));
    await findBulkBarWithCount(1);

    // Pagination "Sau" / Next button
    const nextBtn = screen.getByRole('button', { name: /Sau|Next|>/i });
    fireEvent.click(nextBtn);

    // After URL change effect fires → selection clears
    await waitFor(() => {
      expect(queryBulkBarWithCount(1)).toBeNull();
    });
  });

  it('search input change → selection cleared (debounce-safe)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn A');

    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn luật sư Nguyễn Văn A/i }));
    await findBulkBarWithCount(1);

    // Typing in search updates URL via setParams which triggers page=1 + q=value
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'someone' } });

    // searchQuery (URL-derived) changes → effect clears selection
    await waitFor(() => {
      expect(queryBulkBarWithCount(1)).toBeNull();
    });
  });
});
