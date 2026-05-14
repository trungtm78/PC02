import { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { calendarEventsApi } from '@/lib/api';

type EventScopeFE = 'SYSTEM' | 'TEAM' | 'PERSONAL';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Event id (NOT the calendar event id with -date suffix — pass the raw eventId). */
  eventId: string;
  occurrenceDate: string; // YYYY-MM-DD
  eventTitle: string;
  isRecurring: boolean;
  onDeleted?: () => void;
  // v0.21.7.0 — extended context cho user trước khi confirm xóa.
  // Tất cả optional để legacy events (deadline/holiday không có category/scope)
  // vẫn render OK với fields cơ bản.
  description?: string;
  categoryName?: string;
  categoryColor?: string;
  scope?: EventScopeFE;
  allDay?: boolean;
  startTime?: string; // "HH:MM"
  endTime?: string;
}

const SCOPE_LABEL: Record<EventScopeFE, string> = {
  SYSTEM: '🏛️ Toàn cơ quan',
  TEAM: '👥 Cấp tổ',
  PERSONAL: '🧑 Cá nhân',
};

/**
 * Confirmation dialog for deleting a calendar event.
 *
 * Non-recurring events: simple "Xóa sự kiện?" Yes/No.
 * Recurring events: two options — "Chỉ ngày này" (calls excludeOccurrence,
 * inserts EXDATE override row) vs "Cả chuỗi" (soft-deletes parent event).
 *
 * Data-integrity critical: per design review, deleting a recurring event must
 * make this distinction explicit so users don't accidentally nuke 52 occurrences.
 */
export function RecurringDeleteDialog({
  isOpen,
  onClose,
  eventId,
  occurrenceDate,
  eventTitle,
  isRecurring,
  onDeleted,
  description,
  categoryName,
  categoryColor,
  scope,
  allDay,
  startTime,
  endTime,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDeleteSeries = async () => {
    setDeleting(true);
    setError('');
    try {
      await calendarEventsApi.remove(eventId);
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Không xóa được');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOccurrence = async () => {
    setDeleting(true);
    setError('');
    try {
      await calendarEventsApi.excludeOccurrence(eventId, occurrenceDate);
      onDeleted?.();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Không xóa được');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Xóa sự kiện
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
          )}

          <div className="space-y-2 text-sm">
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide">Sự kiện</p>
              <p className="font-semibold text-slate-800">{eventTitle}</p>
            </div>

            {(categoryName || scope) && (
              <div className="flex items-center gap-2 flex-wrap">
                {categoryName && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs text-white"
                    style={{ backgroundColor: categoryColor || '#64748b' }}
                  >
                    {categoryName}
                  </span>
                )}
                {scope && (
                  <span className="text-xs text-slate-600">{SCOPE_LABEL[scope]}</span>
                )}
              </div>
            )}

            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wide">Thời gian</p>
              <p className="text-slate-700">
                {occurrenceDate}
                {allDay === false && startTime && (
                  <> • {startTime}{endTime ? ` - ${endTime}` : ''}</>
                )}
              </p>
            </div>

            {description && (
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide">Mô tả</p>
                <p className="text-slate-700 line-clamp-3">{description}</p>
              </div>
            )}
          </div>

          {isRecurring ? (
            <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded p-3">
              Đây là sự kiện <strong>lặp lại</strong>. Bạn muốn xóa thế nào?
            </div>
          ) : (
            <p className="text-sm text-slate-600">Bạn có chắc muốn xóa sự kiện này?</p>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex flex-col gap-2">
          {isRecurring && (
            <button
              onClick={handleDeleteOccurrence}
              disabled={deleting}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              data-testid="delete-occurrence-btn"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Chỉ xóa ngày {occurrenceDate}
            </button>
          )}
          <button
            onClick={handleDeleteSeries}
            disabled={deleting}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            data-testid="delete-series-btn"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isRecurring ? 'Xóa cả chuỗi sự kiện' : 'Xóa sự kiện'}
          </button>
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
