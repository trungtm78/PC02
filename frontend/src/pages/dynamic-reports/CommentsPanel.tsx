/**
 * S37 (PR9 slice 2) — "Ghi chú/giải trình" panel, shared by the editor's
 * `SubmissionInputPage.tsx` and the manager's `ReportSubmissionReviewPage.tsx`
 * (both sides can read AND write — the backend grants either role access
 * to the same assignment's comments). Append-only: no edit/delete UI,
 * matching the backend's append-only design.
 */
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

interface Props {
  assignmentId: string;
  /** Field keys the "Ghi chú cho ô" dropdown can target; omit for a submission-only panel. */
  fieldOptions?: Array<{ fieldKey: string; label: string }>;
}

const COMMENTS_QUERY_KEY = (assignmentId: string) => [
  'dynamic-reports',
  'comments',
  assignmentId,
];

export default function CommentsPanel({ assignmentId, fieldOptions = [] }: Props) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useQuery({
    queryKey: COMMENTS_QUERY_KEY(assignmentId),
    queryFn: () => dynamicReportsApi.listComments(assignmentId),
  });

  const [fieldKey, setFieldKey] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await dynamicReportsApi.addComment(assignmentId, fieldKey || null, body.trim());
      setBody('');
      setFieldKey('');
      await queryClient.invalidateQueries({ queryKey: COMMENTS_QUERY_KEY(assignmentId) });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="comments-panel">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Ghi chú / giải trình</h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500 mb-3" data-testid="comments-empty">
          Chưa có ghi chú nào.
        </p>
      ) : (
        <ul className="space-y-2 mb-3" data-testid="comments-list">
          {comments.map((c) => (
            <li key={c.id} className="text-sm border-l-2 border-slate-200 pl-2" data-testid={`comment-${c.id}`}>
              <p className="text-slate-700">{c.body}</p>
              <p className="text-xs text-slate-400">
                {c.authorName} · {formatVNDateTime(c.createdAt)}
                {c.fieldKey && <span> · Ô {c.fieldKey}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-red-700 mb-2" data-testid="comment-error">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {fieldOptions.length > 0 && (
          <select
            data-testid="comment-field-select"
            aria-label="Chọn ô để ghi chú"
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Ghi chú cho cả bản nộp</option>
            {fieldOptions.map((f) => (
              <option key={f.fieldKey} value={f.fieldKey}>
                {f.label || f.fieldKey}
              </option>
            ))}
          </select>
        )}
        <textarea
          data-testid="comment-body-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Nhập ghi chú hoặc giải trình…"
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          data-testid="btn-add-comment"
          disabled={busy || !body.trim()}
          onClick={() => void handleAdd()}
          className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
        >
          {busy ? 'Đang gửi…' : 'Thêm ghi chú'}
        </button>
      </div>
    </div>
  );
}
