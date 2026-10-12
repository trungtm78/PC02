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
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
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
    mine: true,
    canDelete: true,
    locked: false,
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
      mine: true,
      canDelete: true,
      locked: false,
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
      mine: true,
      canDelete: true,
      locked: false,
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

  /** axe-core (`select-name`) bắt được select này ở cả S13 và S33-review vì CommentsPanel dùng chung. */
  it('the field picker has an accessible name (axe select-name)', async () => {
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    renderPanel({ fieldOptions: [{ fieldKey: 'Đội 3!C6', label: 'Số vụ mới' }] });
    await waitFor(() => screen.getByTestId('comments-empty'));

    expect(screen.getByTestId('comment-field-select')).toHaveAccessibleName();
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

  describe('edit and delete (created => editable and deletable)', () => {
    const OTHERS: CommentView = { ...COMMENTS[0], id: 'c2', body: 'Của người khác', mine: false, canDelete: false };

    it('your own comment has Sửa and Xoá; somebody else\'s has neither (unless you may delete it)', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([COMMENTS[0], OTHERS, { ...OTHERS, id: 'c3', canDelete: true }]);
      renderPanel();
      await screen.findByTestId('comment-c1');

      expect(screen.getByTestId('btn-edit-comment-c1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-delete-comment-c1')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-edit-comment-c2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-delete-comment-c2')).not.toBeInTheDocument();
      // A manager: cannot rewrite someone else\'s words, can remove them.
      expect(screen.queryByTestId('btn-edit-comment-c3')).not.toBeInTheDocument();
      expect(screen.getByTestId('btn-delete-comment-c3')).toBeInTheDocument();
    });

    it('editing: opens the text, Lưu is disabled until it changes, then sends only the new text and reloads the list', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue(COMMENTS);
      vi.mocked(dynamicReportsApi.updateComment).mockResolvedValue({ ...COMMENTS[0], body: 'Đã sửa' });
      renderPanel();
      fireEvent.click(await screen.findByTestId('btn-edit-comment-c1'));

      expect(screen.getByTestId('comment-edit-input-c1')).toHaveValue('Số liệu tăng do mùa cao điểm');
      expect(screen.getByTestId('btn-save-comment-c1')).toBeDisabled();
      fireEvent.change(screen.getByTestId('comment-edit-input-c1'), { target: { value: '  Đã sửa  ' } });
      fireEvent.click(screen.getByTestId('btn-save-comment-c1'));

      await waitFor(() => expect(dynamicReportsApi.updateComment).toHaveBeenCalledWith('assign1', 'c1', 'Đã sửa'));
      await waitFor(() => expect(dynamicReportsApi.listComments).toHaveBeenCalledTimes(2));
      expect(screen.queryByTestId('comment-edit-input-c1')).not.toBeInTheDocument();
    });

    it('cancelling an edit changes nothing', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue(COMMENTS);
      renderPanel();
      fireEvent.click(await screen.findByTestId('btn-edit-comment-c1'));
      fireEvent.click(screen.getByTestId('btn-cancel-comment-c1'));
      expect(dynamicReportsApi.updateComment).not.toHaveBeenCalled();
      expect(screen.getByTestId('comment-c1')).toHaveTextContent('Số liệu tăng do mùa cao điểm');
    });

    it('deleting asks first; declined = nothing, accepted = the API call and a reload', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue(COMMENTS);
      vi.mocked(dynamicReportsApi.deleteComment).mockResolvedValue({ deleted: true });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      renderPanel();
      fireEvent.click(await screen.findByTestId('btn-delete-comment-c1'));
      expect(dynamicReportsApi.deleteComment).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      fireEvent.click(screen.getByTestId('btn-delete-comment-c1'));
      await waitFor(() => expect(dynamicReportsApi.deleteComment).toHaveBeenCalledWith('assign1', 'c1'));
      await waitFor(() => expect(dynamicReportsApi.listComments).toHaveBeenCalledTimes(2));
    });

    it('a comment of a closed period shows it and offers neither', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([{ ...COMMENTS[0], locked: true, canDelete: false }]);
      renderPanel();
      const row = await screen.findByTestId('comment-c1');
      expect(row).toHaveTextContent('Kỳ đã chốt');
      expect(screen.queryByTestId('btn-edit-comment-c1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-delete-comment-c1')).not.toBeInTheDocument();
    });

    it('a refusal from the server is shown', async () => {
      vi.mocked(dynamicReportsApi.listComments).mockResolvedValue(COMMENTS);
      vi.mocked(dynamicReportsApi.deleteComment).mockRejectedValue(new Error('Kỳ đã chốt'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPanel();
      fireEvent.click(await screen.findByTestId('btn-delete-comment-c1'));
      expect(await screen.findByTestId('comment-error')).toBeInTheDocument();
    });
  });
});
