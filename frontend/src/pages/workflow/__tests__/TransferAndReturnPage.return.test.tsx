/**
 * C10. "Trả hồ sơ" ended with `alert("Đã trả N hồ sơ về ... thành công!")` and
 * called nothing. The officer was told the transfer had happened; the files
 * stayed exactly where they were. "Xuất Excel" and "Làm mới" had no `onClick`
 * at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(() => ({
      email: 'officer@test.local',
      role: 'OFFICER',
      permissions: [
        { action: 'read', subject: 'Case' },
        { action: 'edit', subject: 'Case' },
      ],
    })),
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

import { api } from '@/lib/api';
import { RecordReturnType } from '@/shared/enums/generated';
import TransferAndReturnPage from '../TransferAndReturnPage';

const CASE_ROW = {
  id: 'c-1',
  caseCode: 'VA-2026-00001',
  name: 'Vụ án thử nghiệm',
  status: 'DANG_DIEU_TRA',
  createdAt: '2026-08-01T00:00:00.000Z',
  unit: 'Đội 1',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/cases')) return Promise.resolve({ data: { data: [CASE_ROW], total: 1 } });
    return Promise.resolve({ data: { data: [], total: 0 } });
  });
  vi.mocked(api.post).mockResolvedValue({
    data: { data: { succeeded: [{ id: 'c-1' }], skipped: [], failed: [] } },
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TransferAndReturnPage />
    </MemoryRouter>,
  );
}

async function openReturnModal() {
  renderPage();
  const row = await screen.findByText('VA-2026-00001');
  // Tick the row, then open the return dialog.
  const checkbox = row.closest('tr')!.querySelector('input[type="checkbox"]')!;
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByTestId('return-btn'));
  // The page confirms before opening the form — returning a file is a
  // procedural decision, not a click.
  fireEvent.click(await screen.findByTestId('confirm-proceed-btn'));
  return screen.findByTestId('return-modal');
}

describe('TransferAndReturnPage — trả hồ sơ', () => {
  it('POSTs the return instead of only announcing it', async () => {
    const modal = await openReturnModal();

    fireEvent.change(within(modal).getByTestId('select-return-type'), {
      target: { value: RecordReturnType.KHONG_THUOC_THAM_QUYEN },
    });
    fireEvent.change(within(modal).getByTestId('input-to-unit'), {
      target: { value: 'Công an quận 1' },
    });
    fireEvent.change(within(modal).getByTestId('input-reason'), {
      target: { value: 'Vụ án thuộc thẩm quyền của cơ quan điều tra cấp huyện.' },
    });
    fireEvent.click(within(modal).getByTestId('btn-submit-return'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/workflow/returns', {
        target: 'case',
        ids: ['c-1'],
        returnType: RecordReturnType.KHONG_THUOC_THAM_QUYEN,
        reason: 'Vụ án thuộc thẩm quyền của cơ quan điều tra cấp huyện.',
        toUnit: 'Công an quận 1',
      }),
    );
  });

  it('will not submit without a reason and a receiving unit', async () => {
    const modal = await openReturnModal();

    expect(within(modal).getByTestId('btn-submit-return')).toBeDisabled();

    fireEvent.change(within(modal).getByTestId('select-return-type'), {
      target: { value: RecordReturnType.THIEU_TAI_LIEU },
    });
    fireEvent.change(within(modal).getByTestId('input-to-unit'), { target: { value: 'CA Q1' } });
    fireEvent.change(within(modal).getByTestId('input-reason'), { target: { value: 'ngắn' } });

    expect(within(modal).getByTestId('btn-submit-return')).toBeDisabled();
  });

  it('shows what actually went and what did not', async () => {
    // A batch is not all-or-nothing. Reporting only the total would leave the
    // officer believing files went back that are still sitting here.
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          succeeded: [{ id: 'c-1' }],
          skipped: [{ id: 'c-2', message: 'vụ án này đã được trả và chưa hoàn tác' }],
          failed: [{ id: 'c-3', error: 'Không trả được vụ án. Vui lòng thử lại.' }],
        },
      },
    });
    const modal = await openReturnModal();

    fireEvent.change(within(modal).getByTestId('select-return-type'), {
      target: { value: RecordReturnType.SAI_DIA_BAN },
    });
    fireEvent.change(within(modal).getByTestId('input-to-unit'), { target: { value: 'CA Q1' } });
    fireEvent.change(within(modal).getByTestId('input-reason'), {
      target: { value: 'Địa bàn xảy ra thuộc quận khác.' },
    });
    fireEvent.click(within(modal).getByTestId('btn-submit-return'));

    const result = await screen.findByTestId('return-result');
    expect(result).toHaveTextContent('1 hồ sơ');
    expect(result).toHaveTextContent('đã được trả và chưa hoàn tác');
    expect(result).toHaveTextContent('Không trả được vụ án');
  });

  it('reports a failed call and does not claim success', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 403, data: { error: { message: 'Bạn không có quyền điều phối', details: [] } } },
      }),
    );
    const modal = await openReturnModal();

    fireEvent.change(within(modal).getByTestId('select-return-type'), {
      target: { value: RecordReturnType.LY_DO_KHAC },
    });
    fireEvent.change(within(modal).getByTestId('input-to-unit'), { target: { value: 'CA Q1' } });
    fireEvent.change(within(modal).getByTestId('input-reason'), {
      target: { value: 'Không thuộc thẩm quyền giải quyết của đơn vị.' },
    });
    fireEvent.click(within(modal).getByTestId('btn-submit-return'));

    expect(await screen.findByTestId('submit-error')).toHaveTextContent('Bạn không có quyền điều phối');
    expect(screen.queryByTestId('return-result')).not.toBeInTheDocument();
  });

  it('refuses a selection that mixes record types', async () => {
    // One request returns one kind. The reason and the receiving unit differ by
    // kind, so a mixed batch invites the wrong grounds on half the files.
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/cases')) return Promise.resolve({ data: { data: [CASE_ROW], total: 1 } });
      if (url.startsWith('/petitions'))
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'p-1',
                stt: 'DT-2026-00001',
                senderName: 'Nguyễn Văn A',
                status: 'MOI_TIEP_NHAN',
                createdAt: '2026-08-01T00:00:00.000Z',
              },
            ],
            total: 1,
          },
        });
      return Promise.resolve({ data: { data: [], total: 0 } });
    });

    renderPage();
    await screen.findByText('VA-2026-00001');
    document
      .querySelectorAll('tbody input[type="checkbox"]')
      .forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByTestId('return-btn'));
    fireEvent.click(await screen.findByTestId('confirm-proceed-btn'));

    const modal = await screen.findByTestId('return-modal');
    expect(within(modal).getByTestId('mixed-error')).toBeInTheDocument();
    expect(within(modal).getByTestId('btn-submit-return')).toBeDisabled();
  });

  it('refreshes the list instead of doing nothing', async () => {
    renderPage();
    await screen.findByText('VA-2026-00001');
    const before = vi.mocked(api.get).mock.calls.length;

    fireEvent.click(screen.getByTestId('refresh-btn'));

    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(before));
  });
});
