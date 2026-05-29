import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationEventType =
  | 'CASE_ASSIGNED'
  | 'CASE_STATUS_CHANGED'
  | 'PETITION_ASSIGNED'
  | 'PETITION_RECEIVED'
  | 'INCIDENT_ASSIGNED'
  | 'INCIDENT_CREATED'
  | 'UTDT_ASSIGNED';

interface NotificationPref {
  eventType: NotificationEventType;
  inApp: boolean;
  push: boolean;
}

interface PrefsResponse {
  success: boolean;
  data: NotificationPref[];
}

// ── Groups ────────────────────────────────────────────────────────────────────

const GROUPS: Array<{
  label: string;
  badge: string;
  items: Array<{ type: NotificationEventType; label: string }>;
}> = [
  {
    label: 'Vụ án',
    badge: 'bg-blue-100 text-blue-700',
    items: [
      { type: 'CASE_ASSIGNED', label: 'Được phân công vụ án mới' },
      { type: 'CASE_STATUS_CHANGED', label: 'Vụ án thay đổi trạng thái' },
    ],
  },
  {
    label: 'Tố giác / Đơn thư',
    badge: 'bg-violet-100 text-violet-700',
    items: [
      { type: 'PETITION_ASSIGNED', label: 'Được phân công đơn thư' },
      { type: 'PETITION_RECEIVED', label: 'Đơn thư mới tiếp nhận' },
    ],
  },
  {
    label: 'Vụ việc',
    badge: 'bg-orange-100 text-orange-700',
    items: [
      { type: 'INCIDENT_ASSIGNED', label: 'Được phân công vụ việc' },
      { type: 'INCIDENT_CREATED', label: 'Vụ việc mới phát sinh' },
    ],
  },
  {
    label: 'Ủy thác điều tra',
    badge: 'bg-indigo-100 text-indigo-700',
    items: [{ type: 'UTDT_ASSIGNED', label: 'Được nhận ủy thác điều tra mới' }],
  },
];

// ── API helpers ───────────────────────────────────────────────────────────────

const QUERY_KEY = ['notification-preferences'];

function usePreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<PrefsResponse>('/notification-preferences').then((r) => r.data.data),
    staleTime: 60_000,
  });
}

function useUpsertPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, inApp, push }: { type: NotificationEventType; inApp: boolean; push: boolean }) =>
      api.put(`/notification-preferences/${type}`, { inApp, push }),
    onMutate: async ({ type, inApp, push }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<NotificationPref[]>(QUERY_KEY);
      qc.setQueryData<NotificationPref[]>(QUERY_KEY, (old = []) =>
        old.map((p) => (p.eventType === type ? { ...p, inApp, push } : p)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
    },
  });
}

function useResetPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notification-preferences/reset'),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsModule() {
  const { data: prefs = [], isLoading } = usePreferences();
  const upsertMutation = useUpsertPref();
  const resetMutation = useResetPrefs();

  const prefMap = new Map(prefs.map((p) => [p.eventType, p]));

  function getPref(type: NotificationEventType): { inApp: boolean; push: boolean } {
    return prefMap.get(type) ?? { inApp: true, push: true };
  }

  function handleToggle(type: NotificationEventType, channel: 'inApp' | 'push', value: boolean) {
    const current = getPref(type);
    upsertMutation.mutate({ type, inApp: channel === 'inApp' ? value : current.inApp, push: channel === 'push' ? value : current.push });
  }

  async function handleReset() {
    if (!window.confirm('Đặt lại tất cả thông báo về mặc định?')) return;
    await resetMutation.mutateAsync();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Cấu hình thông báo</h2>
        <button
          onClick={() => void handleReset()}
          disabled={resetMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Đặt lại mặc định
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_80px_80px] bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="px-4 py-2.5">Loại thông báo</div>
          <div className="px-2 py-2.5 text-center">Trong app</div>
          <div className="px-2 py-2.5 text-center">Push (FCM)</div>
        </div>

        {isLoading ? (
          // Skeleton
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px] items-center px-4 py-3 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-48" />
                <div className="flex justify-center"><div className="h-4 w-4 bg-slate-200 rounded" /></div>
                <div className="flex justify-center"><div className="h-4 w-4 bg-slate-200 rounded" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {GROUPS.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100">
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${group.badge}`}>
                    {group.label}
                  </span>
                </div>

                {/* Rows */}
                {group.items.map((item) => {
                  const pref = getPref(item.type);
                  return (
                    <div
                      key={item.type}
                      className="grid grid-cols-[1fr_80px_80px] items-center hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="px-4 py-3 text-sm text-slate-700">{item.label}</div>

                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={pref.inApp}
                          onChange={(e) => handleToggle(item.type, 'inApp', e.target.checked)}
                          aria-label={`${group.label} — ${item.label} — Trong app`}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>

                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={pref.push}
                          onChange={(e) => handleToggle(item.type, 'push', e.target.checked)}
                          aria-label={`${group.label} — ${item.label} — Push FCM`}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        ⚠️ Push chỉ gửi trong giờ làm việc (7:00–18:00 T2–T7). Ngoài giờ → hàng đợi, gửi lúc 7:00 sáng ngày tiếp theo.
      </p>
    </div>
  );
}
