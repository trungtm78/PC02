/**
 * One suite for the alert column of the three lists (petitions, incidents, cases): the page file of each list calls
 * it with its own way of rendering. The pages differ in everything else; what the alert column must do is the same.
 *
 * `api.get` is the mocked `@/lib/api` of the calling test file.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { RecordAlertDto } from '../../bandPresenter';

export interface AlertListSuite {
  /** "the petition list". */
  name: string;
  /** The mocked `api.get`. */
  get: Mock;
  /** `/petitions`: the list route; `${listUrl}/stats` is the cards route. */
  listUrl: string;
  /** The prefix of the page's keys in the address: `petitions`. */
  prefix: string;
  /** Renders the page at `${listUrl}${search}` and tells the address it is at. */
  renderAt(search: string): { getLocation(): string; unmount(): void };
  /** A row the page can draw, without an alert. */
  row: Record<string, unknown>;
  /** What the cards route answers. */
  stats: unknown;
  /** The export button whose column list must leave the alert column out, when the page has one. */
  exportTestId?: string;
}

const AS_OF = '2026-12-10T02:30:00.000Z';

const alert = (over: Partial<RecordAlertDto> = {}): RecordAlertDto => ({
  source: 'FLOW',
  band: 'RED',
  remainingDays: 1,
  stepName: 'Xác minh',
  dueAt: '2026-12-11T16:59:59.999Z',
  ...over,
});

export function alertColumnSuite(suite: AlertListSuite): void {
  const { get, listUrl, prefix } = suite;
  const rows = (alerts: Array<RecordAlertDto | null>) => alerts.map((a, i) => ({ ...suite.row, id: `row-${i + 1}`, alert: a }));

  /** The answers of the mocked server: the list (`on`: with alerts) and the cards. Anything else is refused. */
  function serve(answer: { on: boolean; data?: unknown[]; total?: number; asOf?: string }) {
    get.mockImplementation((url: string) => {
      if (url === listUrl) {
        const data = answer.data ?? (answer.on ? rows([alert()]) : [{ ...suite.row }]);
        return Promise.resolve({ data: { data, total: answer.total ?? data.length, ...(answer.on ? { alertAsOf: answer.asOf ?? AS_OF } : {}) } });
      }
      if (url === `${listUrl}/stats`) return Promise.resolve({ data: suite.stats });
      return Promise.reject(new Error(`Unknown URL: ${url}`));
    });
  }

  const listCalls = () => get.mock.calls.filter((c) => c[0] === listUrl).map((c) => (c[1] as { params: Record<string, unknown> }).params);
  const lastListParams = () => listCalls()[listCalls().length - 1];
  const statsCalls = () => get.mock.calls.filter((c) => c[0] === `${listUrl}/stats`).map((c) => (c[1] as { params: Record<string, unknown> }).params);
  const ready = () => waitFor(() => expect(screen.queryByTestId('list-page-shell-table-loading')).toBeNull());
  const header = () => screen.queryByRole('columnheader', { name: 'Cảnh báo' });

  describe(`the alert column of ${suite.name}`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
    });

    it('does not exist while the rows carry no alert: no column, no cell, no filter, and nothing new is asked', async () => {
      serve({ on: false });
      suite.renderAt('');
      await ready();
      expect(header()).toBeNull();
      expect(screen.queryByTestId('alert-cell')).toBeNull();
      expect(screen.queryByTestId('filter-alert-band')).toBeNull();
      expect(screen.queryByTestId('sort-alert')).toBeNull();
      for (const params of listCalls()) {
        expect(params).not.toHaveProperty('alertBand');
        expect(params).not.toHaveProperty('alertAsOf');
      }
    });

    it('shows the chip and the words of each row: a flow alert with its step, a record deadline without, none as a dash', async () => {
      serve({
        on: true,
        data: rows([
          alert(),
          alert({ band: 'OVERDUE', remainingDays: -2 }),
          alert({ source: 'RECORD_DEADLINE', band: 'YELLOW', remainingDays: 3, stepName: null }),
          alert({ band: 'GREEN', remainingDays: 5, stepName: 'Kết luận' }),
          alert({ band: 'NONE', remainingDays: 40, stepName: 'Thụ lý' }),
          null,
        ]),
      });
      suite.renderAt('');
      await ready();
      await waitFor(() => expect(header()).not.toBeNull());
      const cells = screen.getAllByTestId('alert-cell');
      expect(cells.map((c) => c.textContent)).toEqual([
        'Đỏ · còn 1 ngày · Xác minh',
        'Quá hạn 2 ngày · Xác minh',
        'Vàng · còn 3 ngày',
        'Xanh · còn 5 ngày · Kết luận',
        'Chưa tới ngưỡng · còn 40 ngày · Thụ lý',
        '—',
      ]);
      expect(cells.map((c) => c.getAttribute('data-band'))).toEqual(['RED', 'OVERDUE', 'YELLOW', 'GREEN', 'NONE', null]);
      // The overdue chip is the dark one, the red chip the light one: the colours of the band presenter.
      expect(cells[1].querySelector('span')?.className).toContain('bg-red-900');
      expect(cells[0].querySelector('span')?.className).toContain('bg-red-100');
    });

    it('filters by band through the page filter panel: the list AND the cards are asked with it', async () => {
      serve({ on: true });
      const page = suite.renderAt(`?${prefix}_page=3`);
      await ready();
      const select = await screen.findByTestId('filter-alert-band');
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Tất cả', 'Quá hạn', 'Đỏ', 'Vàng', 'Xanh', 'Chưa tới ngưỡng']);
      fireEvent.change(select, { target: { value: 'RED' } });
      fireEvent.click(screen.getByTestId('btn-apply-filters'));
      await waitFor(() => expect(lastListParams()).toMatchObject({ alertBand: 'RED', offset: 0 }));
      // The filter lives in the address under the page's prefix, and applying it drops the page key.
      expect(page.getLocation()).toContain(`${prefix}_alert=RED`);
      expect(page.getLocation()).not.toContain(`${prefix}_page`);
      await waitFor(() => expect(statsCalls()[statsCalls().length - 1]).toMatchObject({ alertBand: 'RED' }));
    });

    it('reads the band from the address', async () => {
      serve({ on: true });
      suite.renderAt(`?${prefix}_alert=OVERDUE`);
      await ready();
      expect(listCalls()[0]).toMatchObject({ alertBand: 'OVERDUE' });
      expect(((await screen.findByTestId('filter-alert-band')) as HTMLSelectElement).value).toBe('OVERDUE');
    });

    it('sorts by alert from the column header: most urgent first on the first click, the reverse on the second, the default on the third', async () => {
      serve({ on: true });
      const page = suite.renderAt('');
      await ready();
      fireEvent.click(await screen.findByTestId('sort-alert'));
      await waitFor(() => expect(lastListParams()).toMatchObject({ sortBy: 'alert', sortOrder: 'asc' }));
      expect(page.getLocation()).toContain(`${prefix}_sort=alert`);
      expect(page.getLocation()).toContain(`${prefix}_dir=asc`);
      await ready();
      expect(header()).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(screen.getByTestId('sort-alert'));
      await waitFor(() => expect(lastListParams()).toMatchObject({ sortBy: 'alert', sortOrder: 'desc' }));
      await ready();
      fireEvent.click(screen.getByTestId('sort-alert'));
      await waitFor(() => expect(lastListParams()).not.toHaveProperty('sortBy'));
    });

    it('a later page of a list filtered by band is judged at the instant the first page answered', async () => {
      serve({ on: true, total: 90 });
      suite.renderAt(`?${prefix}_alert=YELLOW`);
      await ready();
      expect(listCalls()[0]).not.toHaveProperty('alertAsOf');
      // The server's clock has moved on: page 2 must still pass the first page's instant, not this one.
      serve({ on: true, total: 90, asOf: '2026-12-10T02:45:00.000Z' });
      fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
      await waitFor(() => expect(lastListParams()).toMatchObject({ alertBand: 'YELLOW', alertAsOf: AS_OF }));
      expect(Number(lastListParams().offset)).toBeGreaterThan(0);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
      await waitFor(() => expect(Number(lastListParams().offset)).toBeGreaterThan(Number(listCalls()[1].offset)));
      expect(lastListParams()).toMatchObject({ alertAsOf: AS_OF });
    });

    it('a later page of a list ordered by alert passes the instant too; a list that is neither does not', async () => {
      serve({ on: true, total: 90 });
      const first = suite.renderAt(`?${prefix}_sort=alert&${prefix}_dir=asc`);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
      await waitFor(() => expect(lastListParams()).toMatchObject({ sortBy: 'alert', alertAsOf: AS_OF }));
      first.unmount();

      vi.clearAllMocks();
      serve({ on: true, total: 90 });
      suite.renderAt('');
      await ready();
      fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
      await waitFor(() => expect(Number(lastListParams().offset)).toBeGreaterThan(0));
      expect(lastListParams()).not.toHaveProperty('alertAsOf');
    });

    it('changing the filter takes a new instant: the old one is not carried to another list', async () => {
      serve({ on: true, total: 90 });
      suite.renderAt(`?${prefix}_alert=YELLOW`);
      await ready();
      serve({ on: true, total: 90, asOf: '2026-12-10T03:00:00.000Z' });
      fireEvent.change(await screen.findByTestId('filter-alert-band'), { target: { value: 'RED' } });
      fireEvent.click(screen.getByTestId('btn-apply-filters'));
      await waitFor(() => expect(lastListParams()).toMatchObject({ alertBand: 'RED' }));
      expect(lastListParams()).not.toHaveProperty('alertAsOf');
      await ready();
      fireEvent.click(screen.getByRole('button', { name: /Sau/ }));
      await waitFor(() => expect(lastListParams()).toMatchObject({ alertBand: 'RED', alertAsOf: '2026-12-10T03:00:00.000Z' }));
    });

    if (suite.exportTestId) {
      it('the Excel export is asked for the visible columns WITHOUT the alert column (the export has none), with the band filter', async () => {
        serve({ on: true });
        suite.renderAt(`?${prefix}_alert=RED`);
        await ready();
        await waitFor(() => expect(header()).not.toBeNull());
        get.mockClear();
        fireEvent.click(screen.getByTestId(suite.exportTestId as string));
        await waitFor(() => expect(get.mock.calls.some((c) => String(c[0]).includes('/export/'))).toBe(true));
        const call = get.mock.calls.find((c) => String(c[0]).includes('/export/'));
        const params = (call?.[1] as { params: Record<string, string> }).params;
        expect(params.cot.split(',')).not.toContain('alert');
        expect(params.cot.split(',').length).toBeGreaterThan(3);
        expect(params).toMatchObject({ alertBand: 'RED' });
      });
    }
  });
}
