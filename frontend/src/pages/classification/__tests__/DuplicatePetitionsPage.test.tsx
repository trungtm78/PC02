/**
 * C5. The old page fetched `GET /petitions?limit=100`, labelled every row it
 * got back as a duplicate, printed a similarity percentage no function ever
 * computed, and finished the "merge" with `alert("Đã hợp nhất...")` — no API
 * call at all. The user was told the work was done; nothing was recorded.
 *
 * These tests hold the three claims the rewrite makes: the groups come from the
 * endpoint that scores them, the score shown is the server's own N/M, and the
 * decision reaches the API before anyone is told it succeeded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const auth = vi.hoisted(() => ({
  granted: [
    { action: 'read', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
  ] as { action: string; subject: string }[] | null,
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(() =>
      auth.granted === null
        ? null
        : { email: 'officer@test.local', role: 'OFFICER', permissions: auth.granted },
    ),
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { PetitionDuplicateDecision } from '@/shared/enums/generated';
import { DuplicatePetitionsPage } from '../DuplicatePetitionsPage';

const GROUP = {
  key: 'senderName',
  value: 'Nguyễn Văn Thành',
  count: 2,
  crossTeam: false,
  score: { matched: 3, compared: 4 },
  items: [
    {
      id: 'p-1',
      stt: 'DT-2026-00001',
      senderName: 'Nguyễn Văn Thành',
      senderPhone: '0912445780',
      senderAddress: 'Số 7 Lý Thường Kiệt',
      suspectedPerson: null,
      summary: 'Trình báo chiếm đoạt xe máy.',
      receivedDate: '2026-08-04T00:00:00.000Z',
      status: 'MOI_TIEP_NHAN',
    },
    {
      id: 'p-2',
      stt: 'DT-2026-00004',
      senderName: 'Nguyễn Văn Thành',
      senderPhone: '0912445780',
      senderAddress: 'Số 7 Lý Thường Kiệt',
      suspectedPerson: null,
      summary: 'Trình báo chiếm đoạt xe máy.',
      receivedDate: '2026-08-04T00:00:00.000Z',
      status: 'MOI_TIEP_NHAN',
    },
  ],
};

function mockApi({ groups = [GROUP], links = [] as unknown[] } = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('duplicates/links')) {
      return Promise.resolve({ data: { data: { data: links, total: links.length } } });
    }
    return Promise.resolve({ data: { data: groups } });
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.granted = [
    { action: 'read', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
  ];
  mockApi();
});

describe('DuplicatePetitionsPage', () => {
  it('reads the grouping endpoint, not the whole petition list', async () => {
    // The bug the page existed to demonstrate: `/petitions?limit=100` returns
    // every petition, none of which is known to be a duplicate of anything.
    render(<DuplicatePetitionsPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const urls = vi.mocked(api.get).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith('/petitions/duplicates'))).toBe(true);
    expect(urls.some((u) => /^\/petitions\?/.test(u))).toBe(false);
  });

  it('shows the criteria the server matched, not an invented percentage', async () => {
    render(<DuplicatePetitionsPage />);

    const score = await screen.findByTestId('score-Nguyễn Văn Thành');
    expect(score).toHaveTextContent('Khớp 3/4 tiêu chí');
    expect(document.body.textContent).not.toMatch(/Độ tương đồng|\d+%/);
  });

  it('shows no hardcoded sample citizen', async () => {
    // The old page shipped "Nguyễn Văn A (CCCD: 001234567890)" as static markup,
    // so an empty database still displayed a named person.
    render(<DuplicatePetitionsPage />);
    await screen.findByTestId('group-Nguyễn Văn Thành');

    expect(document.body.textContent).not.toContain('001234567890');
  });

  it('shows an empty state rather than inventing rows', async () => {
    mockApi({ groups: [] });
    render(<DuplicatePetitionsPage />);

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('POSTs the decision instead of only announcing it', async () => {
    render(<DuplicatePetitionsPage />);
    fireEvent.click(await screen.findByTestId('btn-process-Nguyễn Văn Thành'));

    const modal = await screen.findByTestId('process-modal');
    fireEvent.change(within(modal).getByTestId('input-reason'), {
      target: { value: 'Cùng người gửi, cùng nội dung, gửi hai lần trong một tuần.' },
    });
    fireEvent.click(within(modal).getByTestId('btn-submit'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/petitions/duplicates/decide', {
        primaryPetitionId: 'p-1',
        duplicatePetitionId: 'p-2',
        decision: PetitionDuplicateDecision.DA_HOP_NHAT,
        reason: 'Cùng người gửi, cùng nội dung, gửi hai lần trong một tuần.',
      }),
    );
  });

  it('refuses to submit without a reason', async () => {
    // Marking one citizen's petition as a duplicate of another's is an
    // assertion about two people; the reason is the only thing that will still
    // explain it later.
    render(<DuplicatePetitionsPage />);
    fireEvent.click(await screen.findByTestId('btn-process-Nguyễn Văn Thành'));

    const modal = await screen.findByTestId('process-modal');
    expect(within(modal).getByTestId('btn-submit')).toBeDisabled();

    fireEvent.change(within(modal).getByTestId('input-reason'), { target: { value: 'ngắn' } });
    expect(within(modal).getByTestId('btn-submit')).toBeDisabled();
  });

  it('says the merge does not delete the petition', async () => {
    render(<DuplicatePetitionsPage />);
    fireEvent.click(await screen.findByTestId('btn-process-Nguyễn Văn Thành'));

    const modal = await screen.findByTestId('process-modal');
    expect(modal.textContent).toMatch(/Không xoá/);
  });

  it('reports a failed save and does not claim success', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 409, data: { error: { message: 'Đơn đã có quyết định', details: [] } } },
      }),
    );
    render(<DuplicatePetitionsPage />);
    fireEvent.click(await screen.findByTestId('btn-process-Nguyễn Văn Thành'));

    const modal = await screen.findByTestId('process-modal');
    fireEvent.change(within(modal).getByTestId('input-reason'), {
      target: { value: 'Cùng người gửi, cùng nội dung, gửi hai lần.' },
    });
    fireEvent.click(within(modal).getByTestId('btn-submit'));

    expect(await screen.findByTestId('submit-error')).toHaveTextContent('Đơn đã có quyết định');
    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });

  it('stops suggesting a group once every petition in it is settled', async () => {
    mockApi({
      links: [
        {
          id: 'l-1',
          decision: PetitionDuplicateDecision.KHONG_TRUNG,
          reason: 'Hai người khác nhau, khác năm sinh.',
          matchedCriteria: 3,
          comparedCriteria: 4,
          createdAt: '2026-08-05T00:00:00.000Z',
          revertedAt: null,
          primaryPetition: { id: 'p-1', stt: 'DT-2026-00001', senderName: 'Nguyễn Văn Thành' },
          duplicatePetition: { id: 'p-2', stt: 'DT-2026-00004', senderName: 'Nguyễn Văn Thành' },
          decidedBy: { username: 'officer1' },
        },
      ],
    });
    render(<DuplicatePetitionsPage />);

    await screen.findByTestId('decisions');
    expect(screen.queryByTestId('group-Nguyễn Văn Thành')).not.toBeInTheDocument();
  });

  it('hides the decision controls from someone who may only read', async () => {
    auth.granted = [{ action: 'read', subject: 'Petition' }];
    render(<DuplicatePetitionsPage />);

    await screen.findByTestId('group-Nguyễn Văn Thành');
    expect(screen.queryByTestId('btn-process-Nguyễn Văn Thành')).not.toBeInTheDocument();
  });
});
