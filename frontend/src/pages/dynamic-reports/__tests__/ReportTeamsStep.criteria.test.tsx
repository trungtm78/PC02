import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as renderRaw, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportTeamsStep from '../ReportTeamsStep';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { api } from '@/lib/api';
import type { Criterion, ParsedField, ReportTargetConfig } from '@/features/dynamic-reports/types';

function render(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRaw(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

/** "Tiêu chí tổ này phải báo": per team, which of the report's criteria it reports. */
const OFFICERS = [{ value: 'u1', label: 'Nguyễn Văn A', teams: [] }];
const TEAMS = [
  { id: 't1', name: 'Tổ 1', wardId: null },
  { id: 't2', name: 'Tổ 2', wardId: null },
  { id: 't3', name: 'Tổ 3', wardId: null },
];

function field(fieldKey: string, label: string, over: Partial<ParsedField> = {}): ParsedField {
  const [sheetKey, address] = fieldKey.split('!');
  return { sheetKey, address, fieldKey, label, type: 'NUM', format: '', aggregate: 'SUM', source: 'TOKEN', ...over };
}

const CRITERIA: Criterion[] = [
  { itemKey: 'toi-pham', code: null, name: 'Tội phạm', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 2 },
  { itemKey: 'trom-cap', code: null, name: 'Trộm cắp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 3 },
  { itemKey: 'cuop', code: null, name: 'Cướp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 4 },
  { itemKey: 'khac', code: null, name: 'Khác', unit: null, parentItemKey: null, origin: 'MANUAL', sourceRow: null },
];
const FIELDS: ParsedField[] = [
  field('Chỉ tiêu!C3', 'Trộm cắp', { itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' }),
  field('Chỉ tiêu!C4', 'Cướp', { itemKey: 'cuop', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' }),
  field('Chỉ tiêu!C5', 'Khác', { itemKey: 'khac', origin: 'MANUAL' }),
];

const ROLES = [{ userId: 'u1', role: 'MANAGER' as const }];
const TWO_TEAMS: ReportTargetConfig[] = [
  { teamId: 't1', editorUserIds: ['u1'] },
  { teamId: 't2', editorUserIds: ['u1'] },
];

async function renderStep(
  targets: ReportTargetConfig[] = TWO_TEAMS,
  props: Partial<Parameters<typeof ReportTeamsStep>[0]> = {},
) {
  const onNext = vi.fn();
  render(
    <ReportTeamsStep
      onNext={onNext}
      initialRoles={ROLES}
      initialTargets={targets}
      fields={FIELDS}
      criteria={CRITERIA}
      {...props}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('target-t1')).toHaveTextContent('Tổ 1'));
  return onNext;
}

const open = (teamId: string) => fireEvent.click(screen.getByTestId(`btn-team-criteria-toggle-${teamId}`));
const item = (teamId: string, key: string) => screen.getByTestId(`team-criteria-item-${teamId}-${key}`);

describe('ReportTeamsStep — criteria each team reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOfficerOptions).mockReturnValue({ data: OFFICERS, isLoading: false } as never);
    vi.mocked(api.get).mockResolvedValue({ data: TEAMS });
  });

  it('every criterion is ticked to begin with, and the payload then carries no itemKeys at all', async () => {
    const onNext = await renderStep();
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('Tổ 1: 3/3 tiêu chí');

    open('t1');
    expect(item('t1', 'trom-cap')).toBeChecked();
    expect(item('t1', 'cuop')).toBeChecked();
    expect(item('t1', 'khac')).toBeChecked();

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext).toHaveBeenCalledWith(ROLES, [
      { teamId: 't1', editorUserIds: ['u1'] },
      { teamId: 't2', editorUserIds: ['u1'] },
    ]);
    expect(onNext.mock.calls[0][1][0]).not.toHaveProperty('itemKeys');
  });

  it('the section is collapsed until opened; children sit under their parent, with their unit', async () => {
    await renderStep();
    expect(screen.queryByTestId('team-criteria-panel-t1')).not.toBeInTheDocument();
    open('t1');
    const panel = screen.getByTestId('team-criteria-panel-t1');
    expect(panel).toHaveTextContent('Tội phạm');
    expect(panel).toHaveTextContent('Trộm cắp');
    expect(panel).toHaveTextContent('(vụ)');
    expect(screen.getByTestId('team-criteria-group-t1-toi-pham')).toBeChecked();
  });

  it('unticking a criterion changes the count and sends that team\'s ticked keys, in field order', async () => {
    const onNext = await renderStep();
    open('t1');
    fireEvent.click(item('t1', 'cuop'));

    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('Tổ 1: 2/3 tiêu chí');
    expect(screen.getByTestId('team-criteria-count-t2')).toHaveTextContent('Tổ 2: 3/3 tiêu chí');

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext).toHaveBeenCalledWith(ROLES, [
      { teamId: 't1', editorUserIds: ['u1'], itemKeys: ['trom-cap', 'khac'] },
      { teamId: 't2', editorUserIds: ['u1'] },
    ]);
  });

  it('a parent\'s box ticks and clears all its children, and shows "some" in between', async () => {
    await renderStep();
    open('t1');
    const group = screen.getByTestId('team-criteria-group-t1-toi-pham') as HTMLInputElement;

    fireEvent.click(group);
    expect(item('t1', 'trom-cap')).not.toBeChecked();
    expect(item('t1', 'cuop')).not.toBeChecked();
    expect(item('t1', 'khac')).toBeChecked();

    fireEvent.click(item('t1', 'cuop'));
    expect(group.indeterminate).toBe(true);

    fireEvent.click(group);
    expect(item('t1', 'trom-cap')).toBeChecked();
    expect(group.indeterminate).toBe(false);
  });

  it('"Bỏ hết", "Chọn hết" and "Đảo chọn"', async () => {
    await renderStep();
    open('t1');

    fireEvent.click(screen.getByTestId('btn-team-criteria-none-t1'));
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('0/3');
    fireEvent.click(screen.getByTestId('btn-team-criteria-all-t1'));
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('3/3');

    fireEvent.click(item('t1', 'khac'));
    fireEvent.click(screen.getByTestId('btn-team-criteria-invert-t1'));
    expect(item('t1', 'khac')).toBeChecked();
    expect(item('t1', 'trom-cap')).not.toBeChecked();
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('1/3');
  });

  it('the search box narrows the list (accents ignored), and the three buttons then act on what is shown', async () => {
    await renderStep();
    open('t1');
    fireEvent.change(screen.getByTestId('team-criteria-search-t1'), { target: { value: 'cuop' } });

    expect(screen.queryByTestId('team-criteria-item-t1-trom-cap')).not.toBeInTheDocument();
    expect(item('t1', 'cuop')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-team-criteria-none-t1'));
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('2/3');

    fireEvent.change(screen.getByTestId('team-criteria-search-t1'), { target: { value: 'không có gì' } });
    expect(screen.getByTestId('team-criteria-nomatch-t1')).toBeInTheDocument();
  });

  it('"Chép từ tổ…" takes another team\'s ticks', async () => {
    const onNext = await renderStep();
    open('t1');
    fireEvent.click(item('t1', 'cuop'));
    fireEvent.click(item('t1', 'khac'));

    open('t2');
    fireEvent.change(screen.getByTestId('team-criteria-copy-t2'), { target: { value: 't1' } });

    expect(screen.getByTestId('team-criteria-count-t2')).toHaveTextContent('Tổ 2: 1/3 tiêu chí');
    expect(item('t2', 'trom-cap')).toBeChecked();
    expect(item('t2', 'cuop')).not.toBeChecked();
    expect(screen.getByTestId('team-criteria-note')).toHaveTextContent('Tổ 1');

    // A copy, not a link: changing the source afterwards leaves the copy alone.
    fireEvent.click(item('t1', 'trom-cap'));
    expect(item('t2', 'trom-cap')).toBeChecked();
    fireEvent.click(item('t1', 'khac'));

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext.mock.calls[0][1]).toEqual([
      { teamId: 't1', editorUserIds: ['u1'], itemKeys: ['khac'] },
      { teamId: 't2', editorUserIds: ['u1'], itemKeys: ['trom-cap'] },
    ]);
  });

  it('"Áp cho các tổ đang chọn" gives this team\'s ticks to every selected team', async () => {
    const onNext = await renderStep([...TWO_TEAMS, { teamId: 't3', editorUserIds: ['u1'] }]);
    open('t2');
    fireEvent.click(item('t2', 'trom-cap'));
    fireEvent.click(screen.getByTestId('btn-team-criteria-apply-all-t2'));

    for (const id of ['t1', 't2', 't3']) {
      expect(screen.getByTestId(`team-criteria-count-${id}`)).toHaveTextContent('2/3');
    }
    expect(screen.getByTestId('team-criteria-note')).toHaveTextContent('2 tổ');

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext.mock.calls[0][1].map((t: ReportTargetConfig) => t.itemKeys)).toEqual([
      ['cuop', 'khac'],
      ['cuop', 'khac'],
      ['cuop', 'khac'],
    ]);
  });

  it('refuses to continue while a team has nothing ticked, and says which team', async () => {
    const onNext = await renderStep();
    open('t2');
    fireEvent.click(screen.getByTestId('btn-team-criteria-none-t2'));

    expect(screen.getByTestId('team-criteria-empty-error')).toHaveTextContent('Tổ 2');
    expect(screen.getByTestId('team-criteria-empty-error')).not.toHaveTextContent('Tổ 1');
    expect(screen.getByTestId('btn-teams-next')).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(item('t2', 'khac'));
    expect(screen.queryByTestId('team-criteria-empty-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-teams-next')).not.toBeDisabled();
  });

  it('"Xem dạng ma trận" shows criteria against teams, read-only, and can be hidden again', async () => {
    await renderStep();
    open('t1');
    fireEvent.click(item('t1', 'cuop'));

    expect(screen.queryByTestId('team-criteria-matrix')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-toggle-criteria-matrix'));

    const matrix = screen.getByTestId('team-criteria-matrix');
    expect(matrix).toHaveTextContent('Tổ 1');
    expect(matrix).toHaveTextContent('Trộm cắp');
    expect(screen.getByTestId('matrix-t1-cuop')).toHaveAttribute('data-ticked', 'false');
    expect(screen.getByTestId('matrix-t2-cuop')).toHaveAttribute('data-ticked', 'true');
    expect(matrix.querySelector('input')).toBeNull();

    fireEvent.click(screen.getByTestId('btn-toggle-criteria-matrix'));
    expect(screen.queryByTestId('team-criteria-matrix')).not.toBeInTheDocument();
  });

  it('coming back to the step keeps a team\'s subset, minus criteria the report no longer has', async () => {
    await renderStep([
      { teamId: 't1', editorUserIds: ['u1'], itemKeys: ['cuop', 'da-xoa'] },
      { teamId: 't2', editorUserIds: ['u1'], itemKeys: ['da-xoa'] },
    ]);
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('1/3');
    expect(screen.getByTestId('team-criteria-empty-error')).toHaveTextContent('Tổ 2');
  });

  it('an ordinary template report lists its input cells by label, keyed by field key', async () => {
    const plain = [field('Đội 3!C6', 'Số vụ mới'), field('Đội 3!C7', 'Số vụ tồn')];
    const onNext = await renderStep(TWO_TEAMS, { fields: plain, criteria: undefined });
    open('t1');
    expect(screen.getByTestId('team-criteria-panel-t1')).toHaveTextContent('Số vụ mới');
    fireEvent.click(item('t1', 'Đội 3!C7'));

    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext.mock.calls[0][1][0]).toEqual({ teamId: 't1', editorUserIds: ['u1'], itemKeys: ['Đội 3!C6'] });
  });

  it('tells the wizard the names of the chosen teams', async () => {
    const onTeamNames = vi.fn();
    await renderStep(TWO_TEAMS, { onTeamNames });
    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onTeamNames).toHaveBeenCalledWith({ t1: 'Tổ 1', t2: 'Tổ 2' });
  });

  it('without the report\'s fields (the edit screen) there is no checklist and no subset is sent', async () => {
    const onNext = await renderStep(
      [{ teamId: 't1', editorUserIds: ['u1'], itemKeys: ['cuop'] }],
      { fields: undefined, criteria: undefined },
    );
    expect(screen.queryByTestId('team-criteria-t1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-toggle-criteria-matrix')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-teams-next'));
    expect(onNext.mock.calls[0][1]).toEqual([{ teamId: 't1', editorUserIds: ['u1'] }]);
  });
});
