import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import { A11Y_FOCUS_RING, BTN_OUTLINE_SLATE, BTN_PRIMARY } from '@/constants/styles';
import { MergeIncidentContext, type MergeIncidentArgs, type MergeIncidentModalApi } from './MergeIncidentModalContext';
import { useModalLifecycle } from './useModalLifecycle';

interface LinkableIncident {
  id: string;
  code: string;
  name: string;
}

export function MergeIncidentModalProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<LinkableIncident[]>([]);
  const [targetId, setTargetId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionError, setOptionError] = useState('');
  const [reloadOptions, setReloadOptions] = useState(0);

  const lifecycle = useModalLifecycle<MergeIncidentArgs, { success: boolean }, { targetId: string; expectedUpdatedAt?: string }>({
    submitFn: async (args, payload) => {
      const response = await api.patch(`/incidents/${args.recordId}/merge`, payload);
      return (response.data as { success: boolean }) ?? { success: true };
    },
    onSuccess: (_, args) => args.onSuccess?.(),
  });

  const open = useCallback((args: MergeIncidentArgs) => {
    setSearch('');
    setTargetId('');
    setOptions([]);
    setOptionError('');
    lifecycle.open(args);
  }, [lifecycle]);
  const close = useCallback(() => lifecycle.close(), [lifecycle]);
  const apiValue = useMemo<MergeIncidentModalApi>(() => ({ open }), [open]);

  useEffect(() => {
    if (!lifecycle.isOpen || !lifecycle.args) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoadingOptions(true);
      setOptionError('');
      void api.get<{ data: LinkableIncident[] }>('/incidents/linkable', {
        params: { search: search.trim() || undefined, limit: 50 },
      }).then((response) => {
        if (!active) return;
        const data = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
        const visible = data.filter((item) => item.id !== lifecycle.args?.recordId);
        setOptions(visible);
        setTargetId((current) => visible.some((item) => item.id === current) ? current : '');
      }).catch(() => {
        if (active) {
          setOptions([]);
          setTargetId('');
          setOptionError('Không tải được danh sách vụ việc đích.');
        }
      }).finally(() => {
        if (active) setLoadingOptions(false);
      });
    }, search ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [lifecycle.args, lifecycle.isOpen, reloadOptions, search]);

  const submit = async () => {
    if (!lifecycle.args || !targetId || loadingOptions || optionError
      || !options.some((item) => item.id === targetId)) return;
    await lifecycle.submit({
      targetId,
      expectedUpdatedAt: lifecycle.args.currentUpdatedAt,
    });
  };

  return (
    <MergeIncidentContext.Provider value={apiValue}>
      {children}
      {lifecycle.isOpen && lifecycle.args && (
        <div role="dialog" aria-modal="true" data-testid="merge-incident-modal" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Nhập vào vụ việc khác</h2>
              <button type="button" aria-label="Đóng" onClick={close} disabled={lifecycle.isLoading} className={`rounded p-1 hover:bg-slate-100 ${A11Y_FOCUS_RING}`}><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm text-amber-800">Vụ việc hiện tại sẽ chuyển sang trạng thái đã nhập vụ khác. Thao tác này không thể hoàn tác từ màn hình.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="merge-incident-search">Tìm vụ việc đích</label>
            <input id="merge-incident-search" data-testid="merge-incident-search" value={search} onChange={(event) => { setSearch(event.target.value); setTargetId(''); }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Nhập mã hoặc tên vụ việc" />
            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="merge-incident-target">Vụ việc đích <span className="text-red-500">*</span></label>
            <select id="merge-incident-target" data-testid="merge-incident-target" value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={loadingOptions || lifecycle.isLoading} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">{loadingOptions ? 'Đang tải...' : 'Chọn vụ việc'}</option>
              {options.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </select>
            {optionError && (
              <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                <span>{optionError}</span>
                <button type="button" className="font-medium underline" onClick={() => setReloadOptions((value) => value + 1)}>Thử lại</button>
              </div>
            )}
            {lifecycle.error && <div role="alert" className="mt-3 flex gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{lifecycle.error}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={BTN_OUTLINE_SLATE} onClick={close} disabled={lifecycle.isLoading}>Hủy</button>
              <button type="button" data-testid="btn-confirm-merge-incident" className={BTN_PRIMARY} onClick={() => void submit()} disabled={!targetId || loadingOptions || !!optionError || lifecycle.isLoading || !options.some((item) => item.id === targetId)}>Xác nhận nhập vụ</button>
            </div>
          </div>
        </div>
      )}
    </MergeIncidentContext.Provider>
  );
}
