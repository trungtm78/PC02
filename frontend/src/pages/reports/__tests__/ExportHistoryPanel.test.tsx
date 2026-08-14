/**
 * D7/D8. Exporting a Phụ lục left no trace: the file left the system and
 * nobody knew it had. For procedural statistics, "who is holding this copy" is
 * a real question, and the answer has to be lookup-able somewhere.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

import { api } from '@/lib/api';
import { ExportHistoryPanel } from '../ExportHistoryPanel';

const ROW = {
  id: 'e-1',
  reportType: 'PHU_LUC_1',
  fileName: 'PhuLuc1_PC02_1.xlsx',
  rowCount: 42,
  periodStart: '2026-01-01T00:00:00.000Z',
  periodEnd: '2026-06-30T00:00:00.000Z',
  succeeded: true,
  errorText: null,
  createdAt: '2026-08-10T02:00:00.000Z',
  exportedBy: { username: 'officer1', firstName: 'Trần', lastName: 'Văn B' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { data: [ROW], total: 1 } } });
});

describe('ExportHistoryPanel', () => {
  it('shows who exported what, for which period, and how many rows', async () => {
    render(<ExportHistoryPanel />);

    const row = await screen.findByTestId('export-row-e-1');
    expect(row).toHaveTextContent('Phụ lục 1');
    expect(row).toHaveTextContent('42');
    expect(row).toHaveTextContent('Trần Văn B');
  });

  it('marks a half-written export as failed rather than blending it in', async () => {
    // A stream that died mid-file is still data that partly left the system.
    // Showing it the same as a clean export hides exactly the case worth seeing.
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: {
          data: [{ ...ROW, id: 'e-2', succeeded: false, errorText: 'stream closed' }],
          total: 1,
        },
      },
    });
    render(<ExportHistoryPanel />);

    expect(await screen.findByText('Hỏng giữa chừng')).toBeInTheDocument();
  });

  it('shows an empty state rather than a bare table', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { data: [], total: 0 } } });
    render(<ExportHistoryPanel />);

    expect(await screen.findByTestId('export-empty')).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 403, data: { error: { message: 'Không có quyền', details: [] } } },
      }),
    );
    render(<ExportHistoryPanel />);

    expect(await screen.findByTestId('export-error')).toHaveTextContent('Không có quyền');
  });
});
