import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import {
  eventCategoriesApi,
  calendarEventsApi,
  eventRemindersApi,
  type EventCategory,
  type EventScope,
  type CreateEventPayload,
} from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import { RecurrenceBuilder, buildRRule, type RecurrencePreset } from './RecurrenceBuilder';
import { ReminderEditor, type DraftReminder } from './ReminderEditor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string; // YYYY-MM-DD
  onCreated?: () => void;
}

export function CreateEventModal({ isOpen, onClose, defaultDate, onCreated }: Props) {
  const user = authStore.getUser();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [categoryId, setCategoryId] = useState('');
  // Non-admin users can only create PERSONAL events. Admin can pick SYSTEM/PERSONAL.
  const [scope, setScope] = useState<EventScope>('PERSONAL');
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceByDays, setRecurrenceByDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [reminders, setReminders] = useState<DraftReminder[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStartDate(defaultDate);
    setTitle('');
    setDescription('');
    setError('');
    setRecurrencePreset('none');
    setRecurrenceInterval(1);
    setRecurrenceByDays([]);
    setRecurrenceEndDate('');
    setReminders([]);
    setScope('PERSONAL');
    void eventCategoriesApi.list().then((res) => {
      setCategories(res.data);
      if (res.data.length > 0 && !categoryId) {
        setCategoryId(res.data[0].id);
      }
    });
  }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Tên sự kiện không được để trống');
      return;
    }
    if (!categoryId) {
      setError('Chọn danh mục cho sự kiện');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: CreateEventPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        allDay,
        categoryId,
        scope,
      };
      if (!allDay) {
        payload.startTime = startTime;
        payload.endTime = endTime;
      }
      const rrule = buildRRule(recurrencePreset, recurrenceInterval, recurrenceByDays);
      if (rrule) {
        payload.recurrenceRule = rrule;
        if (recurrenceEndDate) payload.recurrenceEndDate = recurrenceEndDate;
      }
      const res = await calendarEventsApi.create(payload);
      const newEventId = res.data.id;
      // Best-effort: create the user-attached reminders. Don't fail the whole
      // operation if one reminder errors (user can re-add later).
      for (const reminder of reminders) {
        try {
          await eventRemindersApi.create(newEventId, reminder);
        } catch {
          // swallow — UI returns success on event create even if reminder fails
        }
      }
      onCreated?.();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Lỗi khi tạo sự kiện');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800">Tạo sự kiện mới</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tên sự kiện <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
              placeholder="VD: Họp giao ban"
              data-testid="create-event-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ngày <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loại</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
                data-testid="create-event-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Cả ngày</span>
            </label>
            {!allDay && (
              <>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-sm"
                />
                <span className="text-sm text-slate-500">đến</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded text-sm"
                />
              </>
            )}
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phạm vi</label>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={scope === 'PERSONAL'}
                    onChange={() => setScope('PERSONAL')}
                  />
                  Cá nhân
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={scope === 'SYSTEM'}
                    onChange={() => setScope('SYSTEM')}
                  />
                  Toàn hệ thống
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lặp lại</label>
            <RecurrenceBuilder
              preset={recurrencePreset}
              customInterval={recurrenceInterval}
              customByDays={recurrenceByDays}
              recurrenceEndDate={recurrenceEndDate}
              onPresetChange={setRecurrencePreset}
              onCustomIntervalChange={setRecurrenceInterval}
              onByDaysChange={setRecurrenceByDays}
              onEndDateChange={setRecurrenceEndDate}
            />
          </div>

          <ReminderEditor reminders={reminders} onChange={setReminders} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
              placeholder="Mô tả chi tiết (không bắt buộc)"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#003973] text-white rounded-lg hover:bg-[#003973]/90 disabled:opacity-50"
            data-testid="create-event-save"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
