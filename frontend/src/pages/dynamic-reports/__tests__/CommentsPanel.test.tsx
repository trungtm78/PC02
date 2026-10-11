import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommentsPanel from '../CommentsPanel';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { CommentView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listComments: vi.fn(),
    addComment: vi.fn(),
  },
}));

function renderPanel(props: Partial<Parameters<typeof CommentsPanel>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentsPanel assignmentId="assign1" {...props} />
    </QueryClientProvider>,
  );
}

const COMMENTS: CommentView[] = [
  {
    id: 'c1',
    fieldKey: 'Đội 3!C6',
    body: 'Số liệu tăng do mùa cao điểm',
    authorName: 'Nguyễn Văn A',
    createdAt: '2026-10-10T10:00:00.000Z',
  },
];

describe('CommentsPanel (S37, PR9 slice 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when there are no comments yet', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    renderPanel();

    await waitFor(() => screen.getByTestId('comments-empty'));
  });

  it('lists existing comments with author/time/field', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue(COMMENTS);
    renderPanel();

    await waitFor(() => screen.getByTestId('comment-c1'));
    expect(screen.getByTestId('comment-c1')).toHaveTextContent('Số liệu tăng do mùa cao điểm');
    expect(screen.getByTestId('comment-c1')).toHaveTextContent('Nguyễn Văn A');
    expect(screen.getByTestId('comment-c1')).toHaveTextContent('Đội 3!C6');
  });

  it('"Thêm ghi chú" stays disabled until the body is non-blank', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    renderPanel();
    await waitFor(() => screen.getByTestId('comments-empty'));

    expect(screen.getByTestId('btn-add-comment')).toBeDisabled();
    fireEvent.change(screen.getByTestId('comment-body-input'), { target: { value: '  ' } });
    expect(screen.getByTestId('btn-add-comment')).toBeDisabled();
    fireEvent.change(screen.getByTestId('comment-body-input'), { target: { value: 'ghi chú' } });
    expect(screen.getByTestId('btn-add-comment')).not.toBeDisabled();
  });

  it('adds a submission-level comment (no field picker) and refetches', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.addComment).mockResolvedValue({
      id: 'c2',
      fieldKey: null,
      body: 'Ghi chú chung',
      authorName: 'u1',
      createdAt: '2026-10-10T10:00:00.000Z',
    });
    renderPanel();
    await waitFor(() => screen.getByTestId('comments-empty'));

    // No fieldOptions passed -> no field picker at all.
    expect(screen.queryByTestId('comment-field-select')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('comment-body-input'), { target: { value: 'Ghi chú chung' } });
    fireEvent.click(screen.getByTestId('btn-add-comment'));

    await waitFor(() => {
      expect(dynamicReportsApi.addComment).toHaveBeenCalledWith('assign1', null, 'Ghi chú chung');
    });
    await waitFor(() => {
      expect(dynamicReportsApi.listComments).toHaveBeenCalledTimes(2);
    });
    // Draft cleared after success.
    expect(screen.getByTestId('comment-body-input')).toHaveValue('');
  });

  it('adds a per-field comment when a field is selected from the picker', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.addComment).mockResolvedValue({
      id: 'c2',
      fieldKey: 'Đội 3!C6',
      body: 'Giải trình',
      authorName: 'u1',
      createdAt: '2026-10-10T10:00:00.000Z',
    });
    renderPanel({ fieldOptions: [{ fieldKey: 'Đội 3!C6', label: 'Số vụ mới' }] });
    await waitFor(() => screen.getByTestId('comments-empty'));

    fireEvent.change(screen.getByTestId('comment-field-select'), { target: { value: 'Đội 3!C6' } });
    fireEvent.change(screen.getByTestId('comment-body-input'), { target: { value: 'Giải trình' } });
    fireEvent.click(screen.getByTestId('btn-add-comment'));

    await waitFor(() => {
      expect(dynamicReportsApi.addComment).toHaveBeenCalledWith('assign1', 'Đội 3!C6', 'Giải trình');
    });
  });

  it('shows an error note when adding a comment fails', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.addComment).mockRejectedValue(new Error('boom'));
    renderPanel();
    await waitFor(() => screen.getByTestId('comments-empty'));

    fireEvent.change(screen.getByTestId('comment-body-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('btn-add-comment'));

    await waitFor(() => screen.getByTestId('comment-error'));
  });
});
