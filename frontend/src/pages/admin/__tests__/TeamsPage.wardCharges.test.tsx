import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TeamsPage from '../TeamsPage';
import { api } from '@/lib/api';
import { teams as t } from '@/locales/vi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/components/SingleWardPicker', () => ({ SingleWardPicker: () => null }));

const base = { level: 1, order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', isActive: true, status: 'ACTIVE' };
const TEAMS = [
  { ...base, id: 't4', name: 'Tổ công tác Số 4', code: 'T4', parentId: null, wardId: null, _count: { members: 3, wardCharges: 2 } },
  { ...base, id: 't1', name: 'Tổ công tác Số 1', code: 'T1', parentId: null, wardId: null, _count: { members: 1, wardCharges: 0 } },
  { ...base, id: 'wvl', name: 'Công an phường Vườn Lài', code: 'VL', parentId: null, level: 2, wardId: 'd-vl', _count: { members: 2 } },
];
const CHOICES = [
  { teamId: 'wbc', name: 'Công an phường Bàn Cờ', wardId: 'd-bc', managerTeam: { id: 't4', name: 'Tổ công tác Số 4' } },
  { teamId: 'wtd', name: 'Công an phường Tân Định', wardId: 'd-td', managerTeam: null },
  { teamId: 'wvl', name: 'Công an phường Vườn Lài', wardId: 'd-vl', managerTeam: { id: 't4', name: 'Tổ công tác Số 4' } },
];
const T4_CHARGES = [
  { wardId: 'd-bc', wardName: 'Phường Bàn Cờ', wardTeamId: 'wbc', wardTeamName: 'Công an phường Bàn Cờ' },
  { wardId: 'd-vl', wardName: 'Phường Vườn Lài', wardTeamId: 'wvl', wardTeamName: 'Công an phường Vườn Lài' },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const openEdit = async (name: string) => {
  const row = (await screen.findByText(name)).closest('div.flex.items-center') as HTMLElement;
  fireEvent.click(within(row.parentElement as HTMLElement).getAllByTitle('Chỉnh sửa')[0]);
};

describe('TeamsPage — wards in charge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/teams/merges') return { data: [] };
      if (url === '/teams/ward-charge-choices') return { data: CHOICES };
      if (url === '/teams/t4/ward-charges') return { data: T4_CHARGES };
      if (url === '/teams/t1/ward-charges') return { data: [] };
      return { data: TEAMS };
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('the tree shows how many wards a PC02 team is in charge of', async () => {
    renderPage();
    expect(await screen.findByTestId('team-ward-charge-count-t4')).toHaveTextContent(t.wardCharges.badge(2));
    expect(screen.queryByTestId('team-ward-charge-count-t1')).toBeNull();
    expect(screen.queryByTestId('team-ward-charge-count-wvl')).toBeNull();
  });

  it('the edit form of a PC02 team has the section, filled with its wards; a ward team has none', async () => {
    renderPage();
    await openEdit('Tổ công tác Số 4');
    expect(await screen.findByTestId('ward-charges-section')).toBeInTheDocument();
    expect(await screen.findByTestId('ward-charges-chip-d-bc')).toHaveTextContent('Công an phường Bàn Cờ');
    expect(screen.getByTestId('ward-charges-chip-d-vl')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hủy'));
    await openEdit('Công an phường Vườn Lài');
    expect(screen.queryByTestId('ward-charges-section')).toBeNull();
  });

  it('saving sends the chosen wards as its own request (removing a chip removes the charge)', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: [T4_CHARGES[1], { wardId: 'd-td', wardName: 'Phường Tân Định', wardTeamId: 'wtd', wardTeamName: 'Công an phường Tân Định' }] });
    renderPage();
    await openEdit('Tổ công tác Số 4');
    await screen.findByTestId('ward-charges-chip-d-bc');

    fireEvent.click(screen.getByTestId('ward-charges-chip-remove-d-bc'));
    fireEvent.click(screen.getByTestId('ward-charges-trigger'));
    fireEvent.click(screen.getByTestId('ward-charges-option-d-td'));
    fireEvent.click(screen.getByTestId('ward-charges-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/teams/t4/ward-charges', { wardIds: ['d-vl', 'd-td'] }));
    expect(await screen.findByTestId('ward-charges-saved')).toHaveTextContent(t.wardCharges.saved(2));
    // The team form itself was not submitted.
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  it('switching to another team without closing the form drops the first team\'s unsaved choice', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: T4_CHARGES });
    renderPage();
    await openEdit('Tổ công tác Số 1');
    await screen.findByTestId('ward-charges-section');
    await waitFor(() => expect(screen.getByTestId('ward-charges-trigger')).toBeInTheDocument());
    // Tổ 1 is given Tân Định, not saved.
    fireEvent.click(screen.getByTestId('ward-charges-trigger'));
    fireEvent.click(await screen.findByTestId('ward-charges-option-d-td'));
    expect(screen.getByTestId('ward-charges-chip-d-td')).toBeInTheDocument();

    // Edit Tổ 4 straight away (the form stays open) and save it untouched.
    await openEdit('Tổ công tác Số 4');
    expect(await screen.findByTestId('ward-charges-chip-d-bc')).toBeInTheDocument();
    expect(screen.queryByTestId('ward-charges-chip-d-td')).toBeNull();
    fireEvent.click(screen.getByTestId('ward-charges-save'));

    // Tổ 4 keeps its own wards: Tổ 1's unsaved choice never reaches it.
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/teams/t4/ward-charges', { wardIds: ['d-bc', 'd-vl'] });
  });

  it('while a save is on its way the choice is locked, so nothing picked meanwhile is thrown away', async () => {
    let finish: (v: unknown) => void = () => {};
    vi.mocked(api.put).mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
    renderPage();
    await openEdit('Tổ công tác Số 4');
    await screen.findByTestId('ward-charges-chip-d-bc');
    fireEvent.click(screen.getByTestId('ward-charges-chip-remove-d-bc'));
    fireEvent.click(screen.getByTestId('ward-charges-save'));

    await waitFor(() => expect(screen.getByTestId('ward-charges-trigger')).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.queryByTestId('ward-charges-chip-remove-d-vl')).toBeNull();
    fireEvent.click(screen.getByTestId('ward-charges-trigger'));
    expect(screen.queryByTestId('ward-charges-search')).toBeNull();

    finish({ data: [T4_CHARGES[1]] });
    await screen.findByTestId('ward-charges-saved');
    expect(screen.getByTestId('ward-charges-trigger')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('ward-charges-chip-d-vl')).toBeInTheDocument();
  });

  it('a ward held by another team is shown as taken, with who holds it', async () => {
    renderPage();
    await openEdit('Tổ công tác Số 1');
    await screen.findByTestId('ward-charges-section');
    fireEvent.click(screen.getByTestId('ward-charges-trigger'));
    const bc = await screen.findByTestId('ward-charges-option-d-bc');
    expect(bc).toHaveTextContent(t.wardCharges.heldBy('Tổ công tác Số 4'));
    expect(bc).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('ward-charges-option-d-td')).not.toHaveAttribute('aria-disabled');
  });

  it('a 409 lists every ward held by another team, one line per ward, naming the team', async () => {
    vi.mocked(api.put).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          success: false,
          error: {
            code: 'TEAM_WARD_ALREADY_CHARGED',
            message: 'TEAM_WARD_ALREADY_CHARGED',
            details: [
              { wardId: 'd-td', wardName: 'Phường Tân Định', teamId: 't9', teamName: 'Tổ công tác Số 9' },
              { wardId: 'd-vl', wardName: 'Phường Vườn Lài', teamId: 't4', teamName: 'Tổ công tác Số 4' },
            ],
          },
        },
      },
    });
    renderPage();
    await openEdit('Tổ công tác Số 1');
    await screen.findByTestId('ward-charges-section');
    fireEvent.click(screen.getByTestId('ward-charges-trigger'));
    fireEvent.click(await screen.findByTestId('ward-charges-option-d-td'));
    fireEvent.click(screen.getByTestId('ward-charges-save'));

    const box = await screen.findByTestId('ward-charges-conflicts');
    expect(within(box).getByTestId('ward-charges-conflict-d-td')).toHaveTextContent('Phường Tân Định đang do Tổ công tác Số 9 phụ trách');
    expect(within(box).getByTestId('ward-charges-conflict-d-vl')).toHaveTextContent('Phường Vườn Lài đang do Tổ công tác Số 4 phụ trách');
    expect(screen.queryByTestId('ward-charges-saved')).toBeNull();
  });

  it('the header offers the template and the import', async () => {
    renderPage();
    await screen.findByText('Tổ công tác Số 4');
    expect(screen.getByTestId('ward-charge-template')).toHaveTextContent(t.wardCharges.import.template);
    fireEvent.click(screen.getByTestId('ward-charge-import-open'));
    expect(screen.getByTestId('ward-charge-import-step1')).toBeInTheDocument();
  });
});
