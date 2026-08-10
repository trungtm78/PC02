/**
 * D9. `BulkOperation` rows were written for a long time and never read: every
 * bulk export, assign or return left one, and the only way to look was psql.
 * When a 200-file batch runs half way, this is the only screen that can say
 * which files went.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '@/lib/api';
import { BulkOperationsPanel } from '../BulkOperationsPanel';

const ROW = {
  id: 'b-1',
  resource: 'Case',
  action: 'BULK_RECORD_RETURN',
  status: 'COMPLETED',
  startedAt: '2026-08-10T02:00:00.000Z',
  completedAt: '2026-08-10T02:00:05.000Z',
  succeededCount: 18,
  skippedCount: 1,
  failedCount: 1,
  actor: { username: 'officer1', firstName: 'Trần', lastName: 'Văn B' },
};

function mockList(rows: unknown[] = [ROW]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (/\/bulk-operations\/[^?]/.test(url)) {
      return Promise.resolve({
        data: {
          data: {
            ...ROW,
            auditItems: [
              { id: 'a-1', action: 'RECORD_RETURNED', subject: 'Case', subjectId: 'VA-2026-00001', createdAt: '2026-08-10T02:00:01.000Z' },
            ],
          },
        },
      });
    }
    return Promise.resolve({ data: { data: { data: rows, total: rows.length } } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList();
});

describe('BulkOperationsPanel', () => {
  it('reads the batch endpoint, not the audit log', async () => {
    // These are two different shapes: one row per record versus one row per
    // batch. Reading /audit-logs here would show the wrong thing entirely.
    render(<BulkOperationsPanel />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const urls = vi.mocked(api.get).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith('/bulk-operations'))).toBe(true);
    expect(urls.some((u) => u.startsWith('/audit-logs'))).toBe(false);
  });

  it('shows the three counts a partial batch is judged by', async () => {
    render(<BulkOperationsPanel />);

    const row = await screen.findByTestId('bulk-row-b-1');
    expect(row).toHaveTextContent('18');
    expect(row).toHaveTextContent('Trả hồ sơ hàng loạt');
    expect(row).toHaveTextContent('Trần Văn B');
  });

  it('opens the per-record rows, which is the question actually asked', async () => {
    // The batch row says eighteen succeeded. Only these say which eighteen.
    render(<BulkOperationsPanel />);
    fireEvent.click(await screen.findByTestId('bulk-detail-b-1'));

    const modal = await screen.findByTestId('bulk-detail-modal');
    expect(within(modal).getByText('VA-2026-00001')).toBeInTheDocument();
  });

  it('reports a failed detail fetch instead of showing an empty panel', async () => {
    // An empty drawer reads as "this batch touched nothing", which is a
    // different and much worse claim than "could not load".
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (/\/bulk-operations\/[^?]/.test(url)) {
        return Promise.reject(
          Object.assign(new Error('boom'), {
            isAxiosError: true,
            response: { status: 500, data: { error: { message: 'Lỗi máy chủ', details: [] } } },
          }),
        );
      }
      return Promise.resolve({ data: { data: { data: [ROW], total: 1 } } });
    });

    render(<BulkOperationsPanel />);
    fireEvent.click(await screen.findByTestId('bulk-detail-b-1'));

    expect(await screen.findByTestId('bulk-detail-error')).toHaveTextContent('Lỗi máy chủ');
    expect(screen.queryByTestId('bulk-detail-modal')).not.toBeInTheDocument();
  });

  it('shows an empty state rather than a blank table', async () => {
    mockList([]);
    render(<BulkOperationsPanel />);

    expect(await screen.findByTestId('bulk-empty')).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 403, data: { error: { message: 'Không có quyền', details: [] } } },
      }),
    );
    render(<BulkOperationsPanel />);

    expect(await screen.findByTestId('bulk-error')).toHaveTextContent('Không có quyền');
  });
});
