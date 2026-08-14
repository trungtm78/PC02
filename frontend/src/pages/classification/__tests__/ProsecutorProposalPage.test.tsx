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

/**
 * Fill everything `validate()` requires, so submit actually reaches the API.
 */
async function fillRequiredFields() {
  await userEvent.type(
    screen.getByPlaceholderText(/VD: KN-/i),
    'KN-2026-001',
  );
  await userEvent.click(
    await screen.findByTestId('proposal-related-case-trigger'),
  );
  await userEvent.click(
    await screen.findByTestId('proposal-related-case-option-case-uuid-1'),
  );
  await userEvent.type(
    screen.getByPlaceholderText(/Trình bày chi tiết/i),
    'Nội dung kiến nghị thử nghiệm',
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
    // The form has to be filled in first. An earlier version of this test
    // clicked submit on an empty form: validation returned before api.post
    // was ever reached, so the assertion below would have passed against the
    // old catch-shows-success code too — a test that measured nothing.
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Vụ án không tồn tại' } } },
    } as never);

    renderPage();
    await openForm();
    await fillRequiredFields();

    await userEvent.click(screen.getByTestId('proposal-submit'));

    // It must have actually tried.
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    // And then said so, without a success message and without closing.
    expect(await screen.findByTestId('proposal-submit-error')).toHaveTextContent(
      'Vụ án không tồn tại',
    );
    expect(screen.queryByText(/thành công/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('proposal-submit')).toBeInTheDocument();
  });

  it('closes only on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);

    renderPage();
    await openForm();
    await fillRequiredFields();

    await userEvent.click(screen.getByTestId('proposal-submit'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('proposal-submit')).not.toBeInTheDocument(),
    );
  });
});
