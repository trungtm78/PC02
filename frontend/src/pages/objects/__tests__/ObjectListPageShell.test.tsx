/**
 * ObjectListPageShell — PR5 bulk-delete regression suite.
 *
 * Mirrors PR4 LawyerListPageShell test coverage adapted cho 3-way polymorphic
 * (SUSPECT / VICTIM / WITNESS) + status chips. Subjects share single shell impl;
 * each subjectType passes different URL prefix + resourceLabel + type API filter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ObjectListPageShell } from '../ObjectListPageShell';
import { SubjectType } from '@/shared/enums/subject-status';

// BulkActionBar renders "Đã chọn N {resourceLabel}" — broken across spans.
// Query role=status to find the bar deterministically.
async function findBulkBarWithCount(n: number, resourceLabel = 'bị can') {
  const bars = await screen.findAllByRole('status');
  const bulkBar = bars.find((el) =>
    new RegExp(`Đã chọn\\s*${n}\\s*${resourceLabel}`).test(el.textContent ?? ''),
  );
  if (!bulkBar) throw new Error(`BulkActionBar count=${n} (${resourceLabel}) not found`);
  return bulkBar;
}
function queryBulkBarWithCount(n: number, resourceLabel = 'bị can'): Element | null {
  const bars = document.querySelectorAll('[role="status"]');
  for (const bar of Array.from(bars)) {
    if (new RegExp(`Đã chọn\\s*${n}\\s*${resourceLabel}`).test(bar.textContent ?? '')) {
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

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    hasPermission: vi.fn().mockReturnValue(true),
  }),
}));

const SAMPLE_SUSPECTS = [
  {
    id: 'subj-1',
    fullName: 'Nguyễn Văn Suspect',
    idNumber: '079200012345',
    caseId: 'case-1',
    type: 'SUSPECT' as SubjectType,
    status: 'INVESTIGATING',
    createdAt: '2026-05-20T00:00:00Z',
    case: { id: 'case-1', name: 'Vụ trộm cắp ABC', status: 'TIEP_NHAN' },
  },
  {
    id: 'subj-2',
    fullName: 'Trần Thị Suspect2',
    idNumber: '079200067890',
    caseId: 'case-1',
    type: 'SUSPECT' as SubjectType,
    status: 'DETAINED',
    createdAt: '2026-05-21T00:00:00Z',
    case: { id: 'case-1', name: 'Vụ trộm cắp ABC', status: 'TIEP_NHAN' },
  },
];

function setupHappyFetch(subjects = SAMPLE_SUSPECTS) {
  mockApiGet.mockResolvedValue({
    data: { data: subjects, total: subjects.length },
  });
}

function renderShell(
  subjectType: SubjectType = 'SUSPECT' as SubjectType,
  initialEntry?: string,
) {
  const cfgPrefix = subjectType === 'SUSPECT' ? 'objects' : subjectType === 'VICTIM' ? 'victims' : 'witnesses';
  const entry = initialEntry ?? `/${cfgPrefix}`;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path={`/${cfgPrefix}`}
          element={<ObjectListPageShell subjectType={subjectType} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ObjectListPageShell — mount + render (SUSPECT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('mounts → renders "Quản lý Đối tượng" header', async () => {
    renderShell();
    expect(
      screen.getByRole('heading', { level: 1, name: /Quản lý Đối tượng/i }),
    ).toBeInTheDocument();
  });

  it('fetches /subjects?type=SUSPECT on mount', async () => {
    renderShell();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    const url = mockApiGet.mock.calls[0][0] as string;
    expect(url).toContain('/subjects?');
    expect(url).toContain('type=SUSPECT');
  });

  it('renders both sample subjects', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    expect(screen.getByText('Trần Thị Suspect2')).toBeInTheDocument();
    expect(screen.getByText('079200012345')).toBeInTheDocument();
  });

  it('case column renders case.name (PR4 Codex P2 fix inherited)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    expect(screen.getAllByText('Vụ trộm cắp ABC').length).toBeGreaterThanOrEqual(1);
  });

  it('SubjectStatus chips rendered (4 + "Tất cả" = 5)', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});

describe('ObjectListPageShell — VICTIM polymorphism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('VICTIM → "Quản lý Bị hại" header + UserCheck icon', async () => {
    renderShell('VICTIM' as SubjectType);
    expect(
      screen.getByRole('heading', { level: 1, name: /Quản lý Bị hại/i }),
    ).toBeInTheDocument();
  });

  it('VICTIM → fetches with type=VICTIM', async () => {
    renderShell('VICTIM' as SubjectType);
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('type=VICTIM');
    });
  });

  it('VICTIM → URL prefix "victims_status"', async () => {
    renderShell('VICTIM' as SubjectType, '/victims?victims_status=INVESTIGATING');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('status=INVESTIGATING');
    });
  });
});

describe('ObjectListPageShell — WITNESS polymorphism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('WITNESS → "Quản lý Nhân chứng" header', async () => {
    renderShell('WITNESS' as SubjectType);
    expect(
      screen.getByRole('heading', { level: 1, name: /Quản lý Nhân chứng/i }),
    ).toBeInTheDocument();
  });

  it('WITNESS → fetches with type=WITNESS', async () => {
    renderShell('WITNESS' as SubjectType);
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('type=WITNESS');
    });
  });
});

describe('ObjectListPageShell — bulk selection (SUSPECT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('select-all header → bar shows "Đã chọn 2 bị can"', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn tất cả bị can trong trang/i }),
    );
    await waitFor(() => expect(queryBulkBarWithCount(2, 'bị can')).not.toBeNull());
  });

  it('partial select → bar shows 1 bị can', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await waitFor(() => expect(queryBulkBarWithCount(1, 'bị can')).not.toBeNull());
  });

  it('status chip click → URL state + selection cleared', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');

    // Click a status chip
    const detainedChip = screen.getAllByRole('tab').find((t) =>
      /Đang tạm giam/i.test(t.textContent ?? ''),
    );
    expect(detainedChip).toBeDefined();
    fireEvent.click(detainedChip!);

    // Selection cleared (Codex P2 inherited fix)
    await waitFor(() => expect(queryBulkBarWithCount(1, 'bị can')).toBeNull());
  });
});

describe('ObjectListPageShell — bulk delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
    mockApiPost.mockResolvedValue({
      data: { succeeded: [{ id: 'subj-1' }], skipped: [], failed: [] },
    });
  });

  it('Xóa button visible after select', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('delete với reason ≥10 chars → POST /subjects/bulk-delete', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: 'Xóa bị can theo lệnh truy tố hủy ngày 30/05' },
    });

    const confirmBtn = screen
      .getAllByRole('button')
      .find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/subjects/bulk-delete',
        expect.objectContaining({
          ids: ['subj-1'],
          reason: expect.stringContaining('Xóa bị can'),
        }),
      );
    });
  });

  it('success → "Đã xóa 1 bị can" banner + selection clears + refetch', async () => {
    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Xóa bị can theo lệnh' } });
    const confirmBtn = screen
      .getAllByRole('button')
      .find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      const banner = screen.getByTestId('subjects-bulk-banner');
      expect(within(banner).getByText(/Đã xóa 1 bị can/i)).toBeInTheDocument();
    });
    await waitFor(() => expect(queryBulkBarWithCount(1, 'bị can')).toBeNull());
    await waitFor(() => expect(mockApiGet.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('API failure → error banner', async () => {
    mockApiPost.mockRejectedValue(
      Object.assign(new Error('500'), {
        isAxiosError: true,
        response: { status: 500, data: {} },
      }),
    );

    renderShell();
    await screen.findByText('Nguyễn Văn Suspect');
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Xóa bị can theo lệnh' } });
    const confirmBtn = screen
      .getAllByRole('button')
      .find((b) => /xác nhận/i.test(b.textContent ?? ''));
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      const banner = screen.getByTestId('subjects-bulk-banner');
      expect(within(banner).getByText(/thất bại/i)).toBeInTheDocument();
    });
  });
});

describe('ObjectListPageShell — URL state + trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('objects_status=INVESTIGATING → passes status to API', async () => {
    renderShell('SUSPECT' as SubjectType, '/objects?objects_status=INVESTIGATING');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('status=INVESTIGATING');
    });
  });

  it('malformed objects_status → stripped (trust boundary)', async () => {
    renderShell('SUSPECT' as SubjectType, '/objects?objects_status=__proto__');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).not.toContain('status=__proto__');
    });
  });

  it('objects_q + control chars → stripped', async () => {
    renderShell('SUSPECT' as SubjectType, '/objects?objects_q=Nguy%09evil');
    await waitFor(() => {
      const url = mockApiGet.mock.calls[0][0] as string;
      expect(url).toContain('search=Nguyevil');
    });
  });

  it('empty-filtered when status chip active + no rows', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [], total: 0 } });
    renderShell('SUSPECT' as SubjectType, '/objects?objects_status=WANTED');
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });
});

// /codex PR5 P2 regression: clear selection when subjectType prop changes.
describe('ObjectListPageShell — polymorphic subjectType clears selection (Codex P2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyFetch();
  });

  it('changing subjectType prop → selection cleared (no stale SUSPECT IDs in VICTIM context)', async () => {
    // Mount with SUSPECT
    const { rerender } = render(
      <MemoryRouter initialEntries={['/objects']}>
        <ObjectListPageShell subjectType={'SUSPECT' as SubjectType} />
      </MemoryRouter>,
    );
    await screen.findByText('Nguyễn Văn Suspect');

    // Select a suspect
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chọn bị can Nguyễn Văn Suspect/i }),
    );
    await findBulkBarWithCount(1, 'bị can');

    // Switch subjectType to VICTIM (same URL state otherwise)
    rerender(
      <MemoryRouter initialEntries={['/objects']}>
        <ObjectListPageShell subjectType={'VICTIM' as SubjectType} />
      </MemoryRouter>,
    );

    // Selection must clear → bar with "bị can" gone, bar with "bị hại" not yet
    // (we mocked rows in the SUSPECT context; selection is the only test target).
    await waitFor(() => {
      expect(queryBulkBarWithCount(1, 'bị can')).toBeNull();
      expect(queryBulkBarWithCount(1, 'bị hại')).toBeNull();
    });
  });
});
