import { useState } from 'react';
import { Bell, Plus, X } from 'lucide-react';

export type DraftReminder = {
  minutesBefore: number;
  channels: Array<'FCM' | 'EMAIL'>;
};

const PRESETS: Array<{ value: number; label: string }> = [
  { value: 15, label: '15 phút trước' },
  { value: 60, label: '1 giờ trước' },
  { value: 1440, label: '1 ngày trước' },
  { value: 10080, label: '1 tuần trước' },
];

interface Props {
  reminders: DraftReminder[];
  onChange: (next: DraftReminder[]) => void;
}

export function ReminderEditor({ reminders, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [minutesBefore, setMinutesBefore] = useState(30);
  const [fcm, setFcm] = useState(true);
  const [email, setEmail] = useState(false);

  const handleAdd = () => {
    const channels: DraftReminder['channels'] = [];
    if (fcm) channels.push('FCM');
    if (email) channels.push('EMAIL');
    if (channels.length === 0) return;
    // Prevent duplicate minutesBefore for the same event
    if (reminders.some((r) => r.minutesBefore === minutesBefore)) return;
    onChange([...reminders, { minutesBefore, channels }]);
    setShowAdd(false);
    setMinutesBefore(30);
    setFcm(true);
    setEmail(false);
  };

  const handleRemove = (idx: number) => {
    onChange(reminders.filter((_, i) => i !== idx));
  };

  const formatTime = (mins: number): string => {
    if (mins < 60) return `${mins} phút`;
    if (mins < 1440) return `${Math.floor(mins / 60)} giờ`;
    return `${Math.floor(mins / 1440)} ngày`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Bell className="w-4 h-4" />
          Nhắc nhở
        </label>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-xs text-[#003973] hover:underline flex items-center gap-1"
            data-testid="add-reminder-btn"
          >
            <Plus className="w-3 h-3" />Thêm
          </button>
        )}
      </div>

      {reminders.length === 0 && !showAdd && (
        <p className="text-xs text-slate-400 italic">Chưa có nhắc nhở. Sự kiện sẽ không gửi thông báo.</p>
      )}

      {reminders.length > 0 && (
        <div className="space-y-1">
          {reminders.map((r, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded text-sm"
              data-testid={`reminder-row-${idx}`}
            >
              <span>
                <strong>{formatTime(r.minutesBefore)}</strong> trước · {r.channels.join(' + ')}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-0.5 hover:bg-slate-200 rounded"
                aria-label="Xóa nhắc nhở"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <div className="flex gap-2 flex-wrap text-sm">
            {PRESETS.map((p) => (
              <label
                key={p.value}
                className="cursor-pointer px-2 py-1 border border-slate-300 rounded has-[:checked]:bg-[#003973] has-[:checked]:text-white has-[:checked]:border-[#003973]"
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={minutesBefore === p.value}
                  onChange={() => setMinutesBefore(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={fcm} onChange={(e) => setFcm(e.target.checked)} />
              Thông báo đẩy
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Email
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-200 rounded"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!fcm && !email}
              className="text-xs px-2 py-1 bg-[#003973] text-white rounded disabled:opacity-50"
              data-testid="save-reminder-btn"
            >
              Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
