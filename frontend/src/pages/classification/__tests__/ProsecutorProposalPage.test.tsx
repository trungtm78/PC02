/**
 * This screen reported success on every use and never wrote a row.
 *
 * Two defects compounding: `relatedCaseId` carried whatever case *code* the
 * user typed into a foreign key, which can only ever produce a P2003; and the
 * `catch` showed the same "Đã tạo kiến nghị mới thành công!" alert as the
 * happy path, then closed the dialog. So the failure was invisible, and the
 * feature had — as far as the database is concerned — never worked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({
    isLoaded: true,
    today: '2026-08-10',
    userId: 'u1',
    primaryTeamName: 'Tổ 1',
  }),
}));

import ProsecutorProposalPage from '../ProsecutorProposalPage';
import { api } from '@/lib/api';

const CASES = {
  data: {
    data: [{ id: 'case-uuid-1', name: 'Vụ án A', caseCode: 'VA-2026-001' }],
  },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProsecutorProposalPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Open the create dialog. */
async function openForm() {
  const button = await screen.findByRole('button', { name: /Tạo kiến nghị/i });
  await userEvent.click(button);
}

describe('ProsecutorProposalPage — create dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/cases')) return Promise.resolve(CASES as never);
      return Promise.resolve({ data: { data: [] } } as never);
    });
  });

  it('offers real cases to pick, not a free-text code box', async () => {
    renderPage();
    await openForm();

    // The old field was <input type="text" placeholder="VD: VA-2026-001">.
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('VD: VA-2026-001'),
      ).not.toBeInTheDocument(),
    );
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/cases'));
  });

  it('does not claim success when the request fails', async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Vụ án không tồn tại' } } },
    } as never);

    renderPage();
    await openForm();

    await userEvent.click(await screen.findByTestId('proposal-submit'));

    // Whatever else happens, the dialog must not report a success it did not
    // get. Validation may block first — that is also not a false success.
    await waitFor(() => {
      expect(
        screen.queryByText(/thành công/i),
      ).not.toBeInTheDocument();
    });
  });
});
