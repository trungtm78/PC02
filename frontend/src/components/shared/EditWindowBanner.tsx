/**
 * D3 — banner "hồ sơ đã hết hạn sửa" kèm nút xin mở lại.
 *
 * Trước đây người dùng chỉ biết hồ sơ hết hạn sửa khi bấm Lưu và bị từ chối —
 * sau khi đã gõ xong. Banner nói trước, và cho một đường đi tiếp thay vì một
 * ngõ cụt.
 *
 * Không hiện gì khi hồ sơ còn sửa được: một dải thông báo thường trực nói
 * "còn 143 giờ" chỉ dạy người dùng bỏ qua chỗ đó.
 */
import { useEffect, useState } from 'react';
import { Lock, Clock, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';

export type EditWindowSubject = 'Case' | 'Incident' | 'Petition';

interface Status {
  locked: boolean;
  windowHours: number;
  hoursElapsed: number;
  hoursRemaining: number;
  pendingRequest: { id: string; createdAt: string } | null;
}

export function EditWindowBanner({
  subjectType,
  subjectId,
}: {
  subjectType: EditWindowSubject;
  subjectId: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // `alive` chứ không phải một `useCallback` gọi từ effect: khi người dùng
    // chuyển sang hồ sơ khác trước lúc câu trả lời về, ghi state của hồ sơ cũ
    // lên màn hình mới là một banner nói sai về hồ sơ đang mở.
    let alive = true;
    void (async () => {
      try {
        const res = await api.get(
          `/edit-window/status?subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`,
        );
        if (alive) setStatus((res.data?.data ?? res.data) as Status);
      } catch {
        // Im lặng có chủ ý: banner là thông tin phụ. Một câu hỏi phụ thất bại
        // không đáng dựng dải đỏ lên đầu trang chi tiết.
      }
    })();
    return () => {
      alive = false;
    };
  }, [subjectType, subjectId, reloadToken]);

  const load = () => setReloadToken((n) => n + 1);

  if (!status?.locked) return null;

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.post('/edit-window/requests', { subjectType, subjectId, reason: reason.trim() });
    } catch (e) {
      setError(extractApiError(e, 'Gửi yêu cầu thất bại').message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setAsking(false);
    setReason('');
    load();
  };

  return (
    <div
      className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3"
      data-testid="edit-window-banner"
    >
      <div className="flex items-start gap-2 text-sm text-amber-900">
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Hồ sơ đã quá thời hạn chỉnh sửa ({status.windowHours} giờ kể từ khi lập). Muốn sửa tiếp,
          gửi yêu cầu mở lại để lãnh đạo duyệt.
        </p>
      </div>

      {status.pendingRequest ? (
        <p className="text-sm text-amber-800 flex items-center gap-2" data-testid="edit-window-pending">
          <Clock className="w-4 h-4" /> Bạn đã gửi yêu cầu, đang chờ duyệt.
        </p>
      ) : asking ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            data-testid="edit-window-reason"
            placeholder="Lý do cần sửa tiếp"
            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
          />
          {error && (
            <p className="text-sm text-red-600" data-testid="edit-window-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void submit()}
              disabled={reason.trim().length < 10 || saving}
              data-testid="edit-window-submit"
              className="px-3 py-1.5 bg-amber-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
            <button
              onClick={() => setAsking(false)}
              className="px-3 py-1.5 border border-amber-300 text-amber-900 rounded-lg text-sm"
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAsking(true)}
          data-testid="edit-window-ask"
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-700 text-white rounded-lg text-sm"
        >
          <Send className="w-3.5 h-3.5" /> Xin mở lại quyền sửa
        </button>
      )}
    </div>
  );
}

export default EditWindowBanner;
