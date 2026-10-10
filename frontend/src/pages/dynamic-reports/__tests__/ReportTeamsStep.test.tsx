import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as renderRaw, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportTeamsStep from '../ReportTeamsStep';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { api } from '@/lib/api';

function render(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRaw(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

const OFFICERS = [
  { value: 'u1', label: 'Nguyễn Văn A', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: true, laDiaBan: false }] },
  { value: 'u2', label: 'Trần Thị B', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false, laDiaBan: false }] },
];

const TEAMS = [
  { id: 't1', name: 'Tổ 1', isActive: true, wardId: null },
  { id: 't2', name: 'Tổ 2', isActive: true, wardId: null },
];

function openAndSelect(testId: string, optionValue: string) {
  fireEvent.click(screen.getByTestId(`${testId}-trigger`));
  fireEvent.click(screen.getByTestId(`${testId}-option-${optionValue}`));
}

describe('ReportTeamsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOfficerOptions).mockReturnValue({ data: OFFICERS, isLoading: false } as never);
    vi.mocked(api.get).mockResolvedValue({ data: TEAMS });
  });

  it('"Tiếp theo" stays disabled until at least one manager and one team-with-editor exist', async () => {
    const onNext = vi.fn();
    render(<ReportTeamsStep onBack={() => {}} onNext={onNext} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/teams', expect.anything()));

    expect(screen.getByTestId('btn-teams-next')).toBeDisabled();
  });

  it('adds a manager, a team, and an editor for that team, then enables "Tiếp theo"', async () => {
    const onNext = vi.fn();
    render(<ReportTeamsStep onBack={() => {}} onNext={onNext} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    openAndSelect('select-add-manager', 'u1');
    fireEvent.click(screen.getByTestId('btn-add-manager'));
    expect(screen.getByTestId('manager-list')).toHaveTextContent('Nguyễn Văn A');

    openAndSelect('select-add-team', 't1');
    fireEvent.click(screen.getByTestId('btn-add-team'));
    expect(screen.getByTestId('target-list')).toHaveTextContent('Tổ 1');

    expect(screen.getByTestId('btn-teams-next')).toBeDisabled();

    openAndSelect('select-add-editor-t1', 'u2');
    fireEvent.click(screen.getByTestId('btn-add-editor-t1'));
    expect(screen.getByTestId('target-t1')).toHaveTextContent('Trần Thị B');

    expect(screen.getByTestId('btn-teams-next')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext).toHaveBeenCalledWith(
      [{ userId: 'u1', role: 'MANAGER' }],
      [{ teamId: 't1', editorUserIds: ['u2'] }],
    );
  });

  it('removing a team also removes its editors', async () => {
    render(<ReportTeamsStep onBack={() => {}} onNext={() => {}} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    openAndSelect('select-add-team', 't1');
    fireEvent.click(screen.getByTestId('btn-add-team'));
    openAndSelect('select-add-editor-t1', 'u1');
    fireEvent.click(screen.getByTestId('btn-add-editor-t1'));
    expect(screen.getByTestId('target-list')).toHaveTextContent('Nguyễn Văn A');

    fireEvent.click(screen.getByTestId('btn-remove-target-t1'));
    expect(screen.queryByTestId('target-t1')).not.toBeInTheDocument();
  });

  it('calls onBack when "Quay lại" is clicked', async () => {
    const onBack = vi.fn();
    render(<ReportTeamsStep onBack={onBack} onNext={() => {}} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Quay lại'));
    expect(onBack).toHaveBeenCalled();
  });
});
