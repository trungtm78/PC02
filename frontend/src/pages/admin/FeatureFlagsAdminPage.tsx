import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { useFeatureFlagsContext } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';
import { authStore } from '@/stores/auth.store';
import { ROLE_NAMES } from '@/shared/enums/roles';

/**
 * Turn modules on and off.
 *
 * Access is checked on `role === ADMIN`, not `hasPermission`. The frontend
 * permission layer is still `MOCK_ALL_PERMISSIONS` — it returns true for
 * everyone — so gating on it here would look like a check and be none
 * (ND-6). The backend is the real gate either way: PATCH requires
 * `write:FeatureFlag`.
 */

/** Vietnamese names for the backend `domain` values. */
const DOMAIN_LABELS: Record<string, string> = {
  core: 'Lõi hệ thống',
  'org-domain': 'Tổ chức',
  'case-domain': 'Vụ án',
  'petition-domain': 'Đơn thư',
  'workflow-domain': 'Quy trình',
  'reporting-domain': 'Báo cáo',
};

/** Unknown domains land here rather than dropping out of the list entirely. */
const OTHER_DOMAIN = 'Khác';

function domainLabel(domain: string | null): string {
  if (!domain) return OTHER_DOMAIN;
  return DOMAIN_LABELS[domain] ?? OTHER_DOMAIN;
}

interface PendingChange {
  flag: FeatureFlag;
  next: boolean;
}

export default function FeatureFlagsAdminPage() {
  const { flags, isLoading, error, refresh } = useFeatureFlagsContext();
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<string>('');
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    setIsAdmin(authStore.getUser()?.role === ROLE_NAMES.ADMIN);
  }, []);

  const grouped = useMemo(() => {
    const byDomain = new Map<string, FeatureFlag[]>();
    for (const flag of flags.values()) {
      const label = domainLabel(flag.domain);
      const list = byDomain.get(label) ?? [];
      list.push(flag);
      byDomain.set(label, list);
    }
    for (const list of byDomain.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    }
    // "Khác" last; everything else alphabetical, so the order is stable
    // between renders and does not depend on Map insertion.
    return [...byDomain.entries()].sort(([a], [b]) => {
      if (a === OTHER_DOMAIN) return 1;
      if (b === OTHER_DOMAIN) return -1;
      return a.localeCompare(b, 'vi');
    });
  }, [flags]);

  const apply = useCallback(
    async (flag: FeatureFlag, next: boolean) => {
      setSaving(flag.key);
      setBanner('');
      try {
        await api.patch(`/feature-flags/${flag.key}`, { enabled: next });
        // Re-read rather than patching local state: the server may have
        // refused in a way that still returns 200 for a different key, and
        // the sidebar reads the same context.
        await refresh();
      } catch (e: unknown) {
        setBanner(
          extractApiError(e, 'Không đổi được trạng thái tính năng.').message,
        );
      } finally {
        setSaving(null);
        setPending(null);
      }
    },
    [refresh],
  );

  if (!isAdmin) {
    return (
      <div className="p-6" data-testid="feature-flags-forbidden">
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            Chỉ quản trị viên được bật/tắt tính năng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="feature-flags-admin-page">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Bật/tắt tính năng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tắt một tính năng sẽ ẩn mục menu tương ứng với mọi người dùng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </button>
      </div>

      {banner && (
        <div
          role="alert"
          data-testid="feature-flags-error"
          className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {banner}
        </div>
      )}

      {error && !banner && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Không tải được danh sách tính năng. Thử bấm Làm mới.
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Đang tải…</p>}

      {grouped.map(([domain, list]) => (
        <section key={domain} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {domain}
          </h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {list.map((flag) => (
              <li
                key={flag.key}
                data-testid={`flag-row-${flag.key}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {flag.label}
                    </span>
                    {flag.isCore && (
                      <span
                        data-testid={`flag-core-${flag.key}`}
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                      >
                        <Lock className="h-3 w-3" />
                        Lõi — không thể tắt
                      </span>
                    )}
                  </div>
                  {flag.description && (
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {flag.description}
                    </p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {flag.key}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={flag.label}
                  disabled={flag.isCore || saving === flag.key}
                  onClick={() =>
                    flag.enabled
                      ? setPending({ flag, next: false })
                      : void apply(flag, true)
                  }
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                    flag.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {flag.enabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="feature-flags-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Tắt &ldquo;{pending.flag.label}&rdquo;?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Mục menu của tính năng này sẽ biến mất với <strong>mọi</strong>{' '}
              người dùng ngay sau khi lưu. Ai đang mở màn hình đó sẽ nhận thông
              báo tính năng đã tắt.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="feature-flags-confirm-ok"
                disabled={saving !== null}
                onClick={() => void apply(pending.flag, pending.next)}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Tắt tính năng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
