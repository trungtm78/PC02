/**
 * v0.37.1 — CaseProvenancePicker component
 *
 * Plan v2.4 Decisions 2A/2B/2C 10/10 (boil-the-lake):
 *
 * - 2A: Empty Petition picker → 3-option exit (Tạo Đơn thư mới link / Chọn nguồn khác / Bỏ trống ghi chú OTHER)
 * - 2B: Source type switch → auto-clear silent + toast + state memory (remember last selection per source)
 * - 2C: Picker API error → inline error + retry button + fallback text input after 2 fails (graceful degradation)
 *
 * Mock endpoint until PR-PICK lands. Real endpoint: GET /petitions/linkable + GET /incidents/linkable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCw, AlertCircle, FilePlus2, FileEdit } from 'lucide-react';
import { CaseProvenance } from '@/shared/enums/generated';
import { api } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { formatVNDate } from '../../../lib/dates';

const RETRY_BEFORE_FALLBACK = 2;

interface CaseProvenancePickerProps {
  provenance: string;
  linkedPetitionId: string;
  linkedIncidentId: string;
  sourceDocumentNote: string;
  expectedPetitionUpdatedAt: string;
  expectedIncidentUpdatedAt: string;
  errors: Partial<Record<string, string>>;
  update: (field: string, value: string) => void;
}

interface PetitionRow {
  id: string;
  stt: string;
  senderName: string;
  receivedDate: string;
  petitionType: string;
  updatedAt: string;
}

interface IncidentRow {
  id: string;
  code: string;
  name?: string;
  ngayDeXuat?: string;
  updatedAt: string;
}

type PickerState<T = PetitionRow | IncidentRow> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; rows: T[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; attempts: number }
  | { kind: 'fallback' };

export function CaseProvenancePicker(props: CaseProvenancePickerProps) {
  const {
    provenance,
    linkedPetitionId,
    linkedIncidentId,
    sourceDocumentNote,
    errors,
    update,
  } = props;

  // Decision 2B 10/10 — state memory: remember last selection per provenance type.
  // Switch back to a source → restore previous selection seamlessly.
  const memory = useRef<{
    linkedPetitionId: string;
    expectedPetitionUpdatedAt: string;
    linkedIncidentId: string;
    expectedIncidentUpdatedAt: string;
  }>({
    linkedPetitionId: '',
    expectedPetitionUpdatedAt: '',
    linkedIncidentId: '',
    expectedIncidentUpdatedAt: '',
  });

  const lastProvenance = useRef<string>('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (lastProvenance.current === provenance) return;

    // Save current values into memory before switching away
    if (lastProvenance.current === CaseProvenance.FROM_PETITION) {
      memory.current.linkedPetitionId = linkedPetitionId;
      memory.current.expectedPetitionUpdatedAt = props.expectedPetitionUpdatedAt;
    } else if (lastProvenance.current === CaseProvenance.FROM_INCIDENT) {
      memory.current.linkedIncidentId = linkedIncidentId;
      memory.current.expectedIncidentUpdatedAt = props.expectedIncidentUpdatedAt;
    }

    // Auto-clear (Decision 2B 10/10) + restore memory if any
    const hadPriorSelection =
      lastProvenance.current === CaseProvenance.FROM_PETITION
        ? !!linkedPetitionId
        : lastProvenance.current === CaseProvenance.FROM_INCIDENT
        ? !!linkedIncidentId
        : false;

    if (provenance === CaseProvenance.FROM_PETITION) {
      update('linkedIncidentId', '');
      update('expectedIncidentUpdatedAt', '');
      update('linkedPetitionId', memory.current.linkedPetitionId);
      update('expectedPetitionUpdatedAt', memory.current.expectedPetitionUpdatedAt);
    } else if (provenance === CaseProvenance.FROM_INCIDENT) {
      update('linkedPetitionId', '');
      update('expectedPetitionUpdatedAt', '');
      update('linkedIncidentId', memory.current.linkedIncidentId);
      update('expectedIncidentUpdatedAt', memory.current.expectedIncidentUpdatedAt);
    } else {
      update('linkedPetitionId', '');
      update('expectedPetitionUpdatedAt', '');
      update('linkedIncidentId', '');
      update('expectedIncidentUpdatedAt', '');
    }

    // Toast notify ONLY if there was a prior selection that got cleared
    if (hadPriorSelection && lastProvenance.current !== '') {
      const source =
        lastProvenance.current === CaseProvenance.FROM_PETITION
          ? 'Đơn thư gốc'
          : 'Vụ việc gốc';
      setToast(`Đã bỏ lựa chọn ${source}. Có thể chọn lại nếu đổi nguồn về cũ.`);
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }

    lastProvenance.current = provenance;
  }, [provenance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!provenance) {
    return (
      <div className="text-sm text-gray-400 italic py-2">
        Chọn nguồn vụ án ở trên để tiếp tục.
      </div>
    );
  }

  if (provenance === CaseProvenance.FROM_PETITION) {
    return (
      <>
        <PetitionPicker
          value={linkedPetitionId}
          onPick={(row) => {
            update('linkedPetitionId', row.id);
            update('expectedPetitionUpdatedAt', row.updatedAt);
          }}
          error={errors.linkedPetitionId}
        />
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  if (provenance === CaseProvenance.FROM_INCIDENT) {
    return (
      <>
        <IncidentPicker
          value={linkedIncidentId}
          onPick={(row) => {
            update('linkedIncidentId', row.id);
            update('expectedIncidentUpdatedAt', row.updatedAt);
          }}
          error={errors.linkedIncidentId}
        />
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  // DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE → text area
  return (
    <>
      <SourceNoteTextarea
        value={sourceDocumentNote}
        onChange={(v) => update('sourceDocumentNote', v)}
        provenance={provenance}
      />
      {toast && <ToastBanner message={toast} />}
    </>
  );
}

/* ─────────────── Sub-components ─────────────── */

function ToastBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md flex items-center gap-2"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function PetitionPicker({
  value,
  onPick,
  error,
}: {
  value: string;
  onPick: (row: PetitionRow) => void;
  error?: string;
}) {
  return (
    <LinkableEntityPicker<PetitionRow>
      label="Chọn Đơn thư gốc"
      placeholder="Nhập STT (DT-...) hoặc tên người gửi"
      endpoint="/petitions/linkable"
      value={value}
      onPick={onPick}
      error={error}
      renderRow={(r) => (
        <>
          <span className="font-mono text-xs text-gray-500">{r.stt}</span>
          {' — '}
          <span>{r.senderName}</span>
          {r.receivedDate && (
            <span className="ml-2 text-xs text-gray-400">
              ({formatVNDate(r.receivedDate)})
            </span>
          )}
        </>
      )}
      emptyState={<PetitionEmptyState />}
      fallbackInputLabel="Nhập STT Đơn thư gốc (VD: DT-2026-00123)"
      fallbackHelpText="Hệ thống sẽ kiểm tra Đơn thư có tồn tại và trong phạm vi của anh khi submit."
      testIdPrefix="petition-picker"
    />
  );
}

function IncidentPicker({
  value,
  onPick,
  error,
}: {
  value: string;
  onPick: (row: IncidentRow) => void;
  error?: string;
}) {
  return (
    <LinkableEntityPicker<IncidentRow>
      label="Chọn Vụ việc gốc"
      placeholder="Nhập mã (VV-...) hoặc nội dung"
      endpoint="/incidents/linkable"
      value={value}
      onPick={onPick}
      error={error}
      renderRow={(r) => (
        <>
          <span className="font-mono text-xs text-gray-500">{r.code}</span>
          {r.name && <span className="ml-2">— {r.name}</span>}
          {r.ngayDeXuat && (
            <span className="ml-2 text-xs text-gray-400">
              ({formatVNDate(r.ngayDeXuat)})
            </span>
          )}
        </>
      )}
      emptyState={<IncidentEmptyState />}
      fallbackInputLabel="Nhập mã Vụ việc gốc (VD: VV-2026-00045)"
      fallbackHelpText="Hệ thống sẽ kiểm tra Vụ việc có tồn tại và trong phạm vi của anh khi submit."
      testIdPrefix="incident-picker"
    />
  );
}

/**
 * Generic autocomplete picker — handles loading/empty/error/retry/fallback.
 * Decision 2C 10/10: 2 retries → fallback text input. Decision 2A: empty state customizable.
 */
function LinkableEntityPicker<T extends { id: string; updatedAt: string }>({
  label,
  placeholder,
  endpoint,
  value,
  onPick,
  error,
  renderRow,
  emptyState,
  fallbackInputLabel,
  fallbackHelpText,
  testIdPrefix,
}: {
  label: string;
  placeholder: string;
  endpoint: string;
  value: string;
  onPick: (row: T) => void;
  error?: string;
  renderRow: (row: T) => React.ReactNode;
  emptyState: React.ReactNode;
  fallbackInputLabel: string;
  fallbackHelpText: string;
  testIdPrefix: string;
}) {
  const [search, setSearch] = useState('');
  const [state, setState] = useState<PickerState<T>>({ kind: 'idle' });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    const currentAttempts =
      state.kind === 'error' ? state.attempts : 0;

    setState({ kind: 'loading' });
    try {
      const resp = await api.get(endpoint, {
        params: { search: debouncedSearch, limit: 50 },
      });
      const rows: T[] = resp.data?.data ?? resp.data ?? [];
      if (rows.length === 0) {
        setState({ kind: 'empty' });
      } else {
        setState({ kind: 'ready', rows });
      }
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Lỗi tải danh sách. Vui lòng thử lại.';
      const newAttempts = currentAttempts + 1;
      if (newAttempts >= RETRY_BEFORE_FALLBACK + 1) {
        setState({ kind: 'fallback' });
      } else {
        setState({ kind: 'error', message, attempts: newAttempts });
      }
    }
  }, [endpoint, debouncedSearch, state.kind === 'error' ? state.attempts : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debouncedSearch.length === 0) {
      // Pre-fetch first page for in-scope items immediately
      fetchData();
      return;
    }
    if (debouncedSearch.length >= 2) {
      fetchData();
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decision 2C fallback path — user types ID directly
  if (state.kind === 'fallback') {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">
          {fallbackInputLabel} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
          value={value}
          onChange={(e) => onPick({ id: e.target.value, updatedAt: new Date().toISOString() } as T)}
          placeholder="VD: DT-2026-00123"
          data-testid={`${testIdPrefix}-fallback-input`}
        />
        <p className="text-xs text-yellow-700">{fallbackHelpText}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid={`${testIdPrefix}-search`}
        />
      </div>

      {state.kind === 'loading' && (
        <div className="text-xs text-gray-500 py-2">Đang tải...</div>
      )}

      {state.kind === 'error' && (
        <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-sm space-y-2">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{state.message}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white border border-red-300 text-red-700 rounded hover:bg-red-100"
            data-testid={`${testIdPrefix}-retry`}
          >
            <RotateCw className="w-3 h-3" /> Thử lại ({state.attempts}/{RETRY_BEFORE_FALLBACK})
          </button>
        </div>
      )}

      {state.kind === 'empty' && emptyState}

      {state.kind === 'ready' && (
        <ul
          role="listbox"
          aria-label={label}
          className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100"
          data-testid={`${testIdPrefix}-results`}
        >
          {state.rows.map((row) => {
            const isSelected = value === row.id;
            return (
              <li
                key={row.id}
                role="option"
                aria-selected={isSelected}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  isSelected ? 'bg-blue-100' : ''
                }`}
                onClick={() => onPick(row)}
                data-testid={`${testIdPrefix}-row-${row.id}`}
              >
                {renderRow(row)}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ─────────────── Empty state — Decision 2A 10/10 (3-option exit) ─────────────── */

function PetitionEmptyState() {
  const navigate = useNavigate();
  // "Tiếp nhận Đơn thư mới" sent the user straight to the petition form. Without
  // `write:Petition` that form 403s on save, after they have retyped the whole
  // record. The other two exits this panel offers still work, so hiding one
  // leaves the user with a route forward.
  const { canCreate } = usePermission();
  const canCreatePetition = canCreate('petitions');
  return (
    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm space-y-3">
      <div className="text-gray-700">
        📭 Không có Đơn thư chưa gắn trong phạm vi của anh.
      </div>
      <div className="text-xs text-gray-500 italic">
        ℹ️ Đơn thư đã link với Vụ án khác sẽ không hiện ở đây.
      </div>
      <div className="space-y-1 pt-1">
        {canCreatePetition && (
          <button
            type="button"
            onClick={() => navigate('/petitions/new')}
            data-testid="btn-provenance-create-petition"
            className="w-full inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md"
          >
            <FilePlus2 className="w-3.5 h-3.5" /> Tiếp nhận Đơn thư mới
          </button>
        )}
        <p className="text-xs text-gray-600 px-1">
          Hoặc đổi <strong>Nguồn vụ án</strong> ở trên sang nguồn khác, hoặc chọn
          "Nguồn pháp lý khác" và ghi chú trong khung "Ghi chú nguồn".
        </p>
      </div>
    </div>
  );
}

function IncidentEmptyState() {
  return (
    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm space-y-2">
      <div className="text-gray-700">
        📭 Không có Vụ việc chưa khởi tố trong phạm vi của anh.
      </div>
      <p className="text-xs text-gray-600">
        Hãy đổi <strong>Nguồn vụ án</strong> sang "CQĐT phát hiện trực tiếp" nếu
        Vụ án không xuất phát từ Vụ việc.
      </p>
    </div>
  );
}

/* ─────────────── Source note textarea ─────────────── */

function SourceNoteTextarea({
  value,
  onChange,
  provenance,
}: {
  value: string;
  onChange: (v: string) => void;
  provenance: string;
}) {
  const placeholder = useMemo(() => {
    switch (provenance) {
      case CaseProvenance.DIRECT_DISCOVERY:
        return 'Mô tả hoàn cảnh phát hiện trực tiếp (thời điểm, địa điểm, hoạt động, ...)';
      case CaseProvenance.TRANSFERRED:
        return 'Ghi số văn bản chuyển, cơ quan chuyển đến, ngày tiếp nhận hồ sơ...';
      case CaseProvenance.OTHER_LEGAL_SOURCE:
        return 'Ghi rõ căn cứ pháp lý (kiến nghị VKS, tự thú, văn bản tố giác đặc biệt, ...)';
      default:
        return 'Ghi chú nguồn (tuỳ chọn)';
    }
  }, [provenance]);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        <FileEdit className="inline w-3.5 h-3.5 mr-1" />
        Ghi chú nguồn
      </label>
      <textarea
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        data-testid="source-note-textarea"
      />
      <p className="text-xs text-gray-500">
        {value.length}/1000 ký tự
      </p>
    </div>
  );
}
