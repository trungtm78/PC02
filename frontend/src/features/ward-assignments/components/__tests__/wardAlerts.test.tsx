import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '@/lib/api';
import { AlertBadge, alertText } from '../AlertBadge';
import { SubjectMatches } from '../SubjectMatches';
import { wardListLink } from '../../api/alerts';
import WardAssignmentStatsPage from '@/pages/ward-assignments/WardAssignmentStatsPage';

/** Lane D on screen. Expected texts from the plan (section 6, 7): "Quá hạn N ngày", the yellow/red bands, numbers open the list. */
const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('AlertBadge', () => {
  it.each([
    [{ level: 'YELLOW', dueOn: '2026-11-27', daysLeft: 7 }, 'Còn 7 ngày'],
    [{ level: 'RED', dueOn: '2026-11-20', daysLeft: 0 }, 'Đến hạn hôm nay'],
    [{ level: 'RED', dueOn: '2026-11-23', daysLeft: 3 }, 'Còn 3 ngày'],
    [{ level: 'OVERDUE', dueOn: '2026-11-19', daysLeft: -1 }, 'Quá hạn 1 ngày'],
    [{ level: 'DONE', dueOn: '2026-11-19', daysLeft: null }, 'Đã hoàn thành'],
    [{ level: 'NONE', dueOn: '2026-12-31', daysLeft: 40 }, '31/12/2026'],
    [{ level: 'NONE', dueOn: null, daysLeft: null }, 'Chưa có hạn'],
  ])('%o → %s', (alert, text) => {
    expect(alertText(alert)).toBe(text);
    render(<AlertBadge alert={alert} />);
    expect(screen.getByTestId('ward-alert-badge')).toHaveTextContent(text);
    expect(screen.getByTestId('ward-alert-badge')).toHaveAttribute('data-level', alert.level);
  });
});

describe('SubjectMatches', () => {
  const matches = [
    { subjectPosition: 1, level: 'CERTAIN', source: 'WARD_ASSIGNMENT', recordId: 'w1', code: '2026-00012', unitName: 'CAP Tân Định', name: 'Nguyễn Văn Tèo' },
    { subjectPosition: 1, level: 'POSSIBLE', source: 'PETITION', recordId: 'p1', code: '2026-11973', unitName: null, name: 'Nguyễn Văn Tèo và đồng bọn' },
  ];

  const withQuery = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );

  it('lists what the server found, says what is the same, opens the other record read only, and a petition says "by name"', async () => {
    get.mockResolvedValueOnce({ data: [{ ...matches[0], reasons: ['ID_NUMBER', 'NAME'], concluded: false }, matches[1]] });
    render(withQuery(<SubjectMatches assignmentId="a1" canConclude={false} />));
    const rows = await screen.findAllByTestId('ward-match-row');
    expect(get).toHaveBeenCalledWith('/ward-assignments/a1/subject-matches');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getAllByTestId('ward-match-reason').map((r) => r.textContent)).toEqual(['Trùng CCCD', 'Trùng họ tên']);
    // The code opens the other record on top of the review, read only, with a way to open it in full.
    get.mockResolvedValueOnce({
      data: { source: 'WARD_ASSIGNMENT', recordId: 'w1', code: '2026-00012', unitName: 'CAP Tân Định', status: 'APPROVED', day: '2026-11-10', summary: 'Trộm xe', people: [{ name: 'Nguyễn Văn Tèo', birthYear: 1990, idNumber: '079090000111', address: null }] },
    });
    fireEvent.click(within(rows[0]).getByTestId('ward-match-open-WARD_ASSIGNMENT-w1'));
    expect(await screen.findByTestId('ward-match-preview-person')).toHaveTextContent('079090000111');
    expect(get).toHaveBeenLastCalledWith('/ward-assignments/a1/subject-matches/preview', { params: { source: 'WARD_ASSIGNMENT', recordId: 'w1' } });
    // The status in words, never the server's code.
    expect(screen.getByTestId('ward-match-preview')).toHaveTextContent('Đã duyệt');
    expect(screen.getByTestId('ward-match-preview')).not.toHaveTextContent('APPROVED');
    expect(screen.getByTestId('ward-match-preview-open')).toHaveAttribute('href', '/ho-so-phan-cong/w1');
    expect(screen.getByTestId('ward-match-preview-open')).toHaveAttribute('target', '_blank');
    expect(within(rows[0]).getByText('Trùng chắc chắn (CCCD)')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Có thể trùng theo tên')).toBeInTheDocument();
    expect(screen.queryByText('Khác người')).not.toBeInTheDocument();
  });

  it('a reviewer concludes "not the same person": the conclusion is sent, the list read again', async () => {
    get.mockResolvedValueOnce({ data: matches }).mockResolvedValueOnce({ data: [matches[1]] });
    post.mockResolvedValueOnce({ data: {} });
    render(
      <MemoryRouter>
        <SubjectMatches assignmentId="a1" canConclude />
      </MemoryRouter>,
    );
    const rows = await screen.findAllByTestId('ward-match-row');
    fireEvent.click(within(rows[0]).getByText('Khác người'));
    await waitFor(() => expect(screen.getAllByTestId('ward-match-row')).toHaveLength(1));
    expect(post).toHaveBeenCalledWith('/ward-assignments/a1/subject-matches/conclusions', { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: 'w1', samePerson: false });
  });

  it('another request: the late answer for the previous one never shows', async () => {
    let answerA: (v: unknown) => void = () => undefined;
    get.mockImplementationOnce(() => new Promise((resolve) => (answerA = resolve))).mockResolvedValueOnce({ data: [matches[1]] });
    const { rerender } = render(
      <MemoryRouter>
        <SubjectMatches assignmentId="a1" canConclude />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <SubjectMatches assignmentId="b2" canConclude />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByTestId('ward-match-row')).toHaveLength(1));
    answerA({ data: matches });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByTestId('ward-match-row')).toHaveLength(1);
    expect(screen.queryByText('Hồ sơ phân công 2026-00012')).not.toBeInTheDocument();
  });

  it('nothing found: says so, without a count', async () => {
    get.mockResolvedValueOnce({ data: [] });
    render(
      <MemoryRouter>
        <SubjectMatches assignmentId="a1" canConclude />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('ward-matches-none')).toBeInTheDocument();
  });

  it('a failed load is said, with a retry, not shown as "nothing found"', async () => {
    get.mockRejectedValueOnce(new Error('down'));
    render(
      <MemoryRouter>
        <SubjectMatches assignmentId="a1" canConclude />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Không dò được');
    expect(screen.queryByTestId('ward-matches-none')).not.toBeInTheDocument();
  });
});

describe('WardAssignmentStatsPage', () => {
  const stats = {
    cards: { total: 5, new: 4, reassign: 1, pending: 1, returned: 1, overdue: 1, onTimeRate: 50, avgSubmissions: 1.2, firstPassRate: 66.7, avgReviewDays: 2.2 },
    byMonth: [{ month: '2026-10', new: 1, reassign: 1 }],
    byUnit: [{ teamId: 't1', name: 'CAP Vườn Lài', total: 3, new: 2, reassign: 1, pending: 1, returned: 0, overdue: 1, onTimeRate: 100, avgSubmissions: 1.33, firstPassRate: 50, avgReviewDays: 2.3 }],
    byCrime: [
      { crimeId: 'c1', name: 'Tội đánh bạc', total: 4, new: 3, reassign: 1 },
      { crimeId: null, name: null, total: 1, new: 1, reassign: 0 },
    ],
  };

  it('asks with the filters of the address; every number opens the list with the same filters', async () => {
    get.mockResolvedValueOnce({ data: stats });
    render(
      <MemoryRouter initialEntries={['/ho-so-phan-cong/thong-ke?from=2026-10-01&to=2026-10-31']}>
        <Routes>
          <Route path="/ho-so-phan-cong/thong-ke" element={<WardAssignmentStatsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('ward-stats-cards');
    expect(get).toHaveBeenCalledWith('/ward-assignments/stats', { params: { from: '2026-10-01', to: '2026-10-31' } });
    expect(screen.getByTestId('ward-card-overdue').closest('a')).toHaveAttribute('href', '/ho-so-phan-cong?submitted=true&from=2026-10-01&to=2026-10-31&alert=OVERDUE');
    expect(screen.getByTestId('ward-card-pending').closest('a')).toHaveAttribute('href', '/ho-so-phan-cong?submitted=true&from=2026-10-01&to=2026-10-31&status=SUBMITTED');
    expect(screen.getByTestId('ward-card-onTimeRate')).toHaveTextContent('50%');
    const unit = within(screen.getByTestId('ward-stats-units'));
    expect(unit.getByText('3').closest('a')).toHaveAttribute('href', '/ho-so-phan-cong?submitted=true&from=2026-10-01&to=2026-10-31&teamId=t1');
    // A crime outside the catalogue has no filter of its own: no link that would open the wrong rows.
    const crimes = within(screen.getByTestId('ward-stats-crimes'));
    expect(crimes.getByText('Khác / chưa chọn').closest('tr')?.querySelector('a')).toBeNull();
  });

  it('a rate with nothing to divide by is "—", never 0%', async () => {
    get.mockResolvedValueOnce({ data: { ...stats, cards: { ...stats.cards, onTimeRate: null } } });
    render(
      <MemoryRouter>
        <WardAssignmentStatsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('ward-card-onTimeRate')).toHaveTextContent('—');
  });

  it('wardListLink leaves out what is not given', () => {
    expect(wardListLink({})).toBe('/ho-so-phan-cong');
    expect(wardListLink({ teamId: null, status: 'RETURNED' })).toBe('/ho-so-phan-cong?status=RETURNED');
  });
});
