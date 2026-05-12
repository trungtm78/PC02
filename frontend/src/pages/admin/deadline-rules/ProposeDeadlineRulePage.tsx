import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, AlertCircle, Loader2, Lightbulb, X } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import {
  DOCUMENT_TYPES,
  DOCUMENT_ISSUERS,
  type ProposeRuleInput,
  type UpdateDraftInput,
} from '@/features/deadline-rules/types';
import { DEADLINE_RULE_KEY_LABEL, DEADLINE_RULE_KEY_UNIT } from '@/shared/enums/status-labels';
import { DocumentUrlInput } from '@/features/deadline-rules/components/DocumentUrlInput';

/**
 * Pre-fill suggestions surfaced on `?prefill=migration` flow when admin clicks
 * "Bổ sung tài liệu" from MigrationCleanupPage. Mirrors backend constant
 * `MIGRATED_RULE_URL_HINTS` in law-source-hints.constants.ts — kept in sync
 * manually (10-12 entries, low churn). If list grows, generate from backend.
 */
interface MigratedRuleHint {
  docType: string;
  number: string;
  issuer: string;
  date: string;
  url: string;
}

const MIGRATED_RULE_URL_HINTS: Record<string, MigratedRuleHint> = {
  THOI_HAN_XAC_MINH:     { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GIA_HAN_1:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GIA_HAN_2:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_TOI_DA:       { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_PHUC_HOI:     { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_PHAN_LOAI:    { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  SO_LAN_GIA_HAN_TOI_DA: { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_GUI_QD_VKS:   { docType: 'BLTTHS', number: '101/2015/QH13', issuer: 'Quốc hội', date: '2015-11-27', url: 'https://vbpl.vn/bo-luat-to-tung-hinh-su-2015' },
  THOI_HAN_TO_CAO:       { docType: 'Khác',   number: '25/2018/QH14', issuer: 'Quốc hội', date: '2018-06-12', url: 'https://vbpl.vn/luat-to-cao-2018' },
  THOI_HAN_KHIEU_NAI:    { docType: 'Khác',   number: '02/2011/QH13', issuer: 'Quốc hội', date: '2011-11-11', url: 'https://vbpl.vn/luat-khieu-nai-2011' },
};

interface FormState {
  value: string;
  label: string;
  legalBasis: string;
  documentType: string;
  documentNumber: string;
  documentIssuer: string;
  documentDate: string;
  documentUrl: string;
  reason: string;
  effectiveFrom: string;
}

const EMPTY_FORM: FormState = {
  value: '',
  label: '',
  legalBasis: '',
  documentType: 'TT',
  documentNumber: '',
  documentIssuer: 'BCA',
  documentDate: '',
  documentUrl: '',
  reason: '',
  effectiveFrom: '',
};

/**
 * ProposeDeadlineRulePage — admin proposes a new version for a rule key.
 *
 * Submit flow: Save Draft → Submit for Review → Approver decision.
 * Pre-loads value+label+legalBasis from the current active version so the user
 * sees a diff target. Mandatory fields validated client-side; server enforces
 * the truth (effectiveFrom clamps, key whitelist, etc.).
 */
export default function ProposeDeadlineRulePage() {
  // Two routes drive this page:
  //   - /admin/deadline-rules/:key/propose       → create mode (key = ruleKey, no editId)
  //   - /admin/deadline-rules/edit/:id           → edit mode (id = versionId, ruleKey from loaded version)
  const { key: keyParam, id: editId } = useParams<{ key?: string; id?: string }>();
  const isEditMode = !!editId;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Two error channels — keeps silent-click bug from coming back.
  // fieldErrors: per-input messages rendered inline + in a summary above buttons.
  // submitError: server/mutation failure not tied to a single field (auth, network, conflict).
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Migration cleanup banner: shown when admin lands via ?prefill=migration AND
  // a hint exists for this ruleKey. Admin must click "Dùng đề xuất" to apply —
  // banner never auto-overwrites form fields (per autoplan Design consensus).
  // Suppressed in edit mode (existing draft has its own data).
  const prefillRequested = searchParams.get('prefill') === 'migration';
  const prefillHint = !isEditMode && keyParam && prefillRequested ? MIGRATED_RULE_URL_HINTS[keyParam] : null;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Create mode: preload defaults from current active rule of this key ─────
  const activeQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.active,
    queryFn: () => deadlineRulesApi.listActive(),
    staleTime: 30_000,
    enabled: !isEditMode,
  });

  useEffect(() => {
    // Gate on !isEditMode — edit mode's loaded draft must NOT be clobbered by
    // active-rule defaults (CEO/Eng review C7).
    if (isEditMode || !keyParam || !activeQ.data) return;
    const current = activeQ.data.data.find((r) => r.ruleKey === keyParam);
    if (current) {
      setForm((prev) => ({
        ...prev,
        value: String(current.value),
        label: current.label,
        legalBasis: current.legalBasis,
      }));
    }
  }, [isEditMode, keyParam, activeQ.data]);

  // ── Edit mode: load draft from the server and prefill the form ─────────────
  const editVersionQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.detail(editId ?? ''),
    queryFn: () => deadlineRulesApi.getById(editId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!isEditMode || !editVersionQ.data) return;
    const v = editVersionQ.data.data;
    // Bookmark protection: if version is no longer a draft (already submitted /
    // approved / etc.), redirect to the read-only version page.
    if (v.status !== 'draft') {
      navigate(`/admin/deadline-rules/version/${v.id}`, { replace: true });
      return;
    }
    setForm({
      value: String(v.value),
      label: v.label,
      legalBasis: v.legalBasis,
      documentType: v.documentType,
      documentNumber: v.documentNumber,
      documentIssuer: v.documentIssuer,
      documentDate: v.documentDate ? v.documentDate.slice(0, 10) : '',
      documentUrl: v.documentUrl ?? '',
      reason: v.reason ?? '',
      effectiveFrom: v.effectiveFrom ? v.effectiveFrom.slice(0, 10) : '',
    });
  }, [isEditMode, editVersionQ.data, navigate]);

  // Effective ruleKey: from URL in create mode, from loaded version in edit mode.
  const effectiveKey = isEditMode ? editVersionQ.data?.data.ruleKey : keyParam;
  // Approver's "request-changes" note pinned to the form when proposer reopens
  // a draft that was sent back. Cleared on resubmit by backend submit() (C2).
  const requestChangesNote = isEditMode ? editVersionQ.data?.data.reviewNotes ?? null : null;

  // ── Mutations (mode-aware) ─────────────────────────────────────────────────
  const saveDraftMut = useMutation({
    mutationFn: (input: ProposeRuleInput) => {
      if (isEditMode && editId) {
        // updateDraft uses partial UpdateDraftInput; reuse ProposeRuleInput fields.
        const dto: UpdateDraftInput = { ...input };
        return deadlineRulesApi.updateDraft(editId, dto);
      }
      return deadlineRulesApi.propose(input);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.active });
      if (isEditMode && editId) {
        queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.detail(editId) });
      }
      navigate(`/admin/deadline-rules/version/${res.data.id}`);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) => {
      console.error('[deadline-rules] save-draft failed', e);
      setSubmitError(e.response?.data?.message ?? e.message ?? 'Lưu thất bại');
    },
  });

  const submitMut = useMutation({
    mutationFn: async (input: ProposeRuleInput) => {
      if (isEditMode && editId) {
        // Edit mode: write latest fields to the draft, then transition draft → submitted.
        // If submit fails mid-flight, the updateDraft already applied → user can retry from draft.
        const dto: UpdateDraftInput = { ...input };
        await deadlineRulesApi.updateDraft(editId, dto);
        return deadlineRulesApi.submit(editId);
      }
      const created = await deadlineRulesApi.propose(input);
      return deadlineRulesApi.submit(created.data.id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.active });
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.summary });
      if (isEditMode && editId) {
        queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.detail(editId) });
      }
      navigate(`/admin/deadline-rules/version/${res.data.id}`);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) => {
      console.error('[deadline-rules] submit failed', e);
      setSubmitError(e.response?.data?.message ?? e.message ?? 'Gửi duyệt thất bại');
    },
  });

  // Loading guard for edit mode while we fetch the existing draft.
  if (isEditMode && editVersionQ.isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-600" data-testid="edit-mode-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bản nháp...
      </div>
    );
  }

  if (!effectiveKey) {
    return <div className="p-6 text-red-600">Thiếu mã quy tắc</div>;
  }
  // Bind to a local const so TypeScript narrows away undefined inside callbacks.
  const ruleKeyForSubmit: string = effectiveKey;

  // Maps fieldErrors keys to data-testid stems so scrollIntoView can land on the right input.
  const FIELD_TESTID_MAP: Record<keyof FormState, string> = {
    value: 'input-value',
    label: 'input-label',
    legalBasis: 'input-legal-basis',
    documentType: 'select-doc-type',
    documentNumber: 'input-doc-number',
    documentIssuer: 'select-doc-issuer',
    documentDate: 'input-doc-date',
    documentUrl: 'input-doc-url',
    reason: 'input-reason',
    effectiveFrom: 'input-effective-from',
  };

  const validate = (): ProposeRuleInput | null => {
    // Collect every failing field in one pass so the user sees ALL problems, not just the first.
    // Keep error strings stable — existing tests grep them via getByText(/.../) regex.
    const errors: Partial<Record<keyof FormState, string>> = {};
    const valueNum = parseInt(form.value, 10);
    if (isNaN(valueNum) || valueNum < 1) {
      errors.value = 'Giá trị phải là số nguyên dương';
    }
    if (!form.label.trim()) {
      errors.label = 'Tên hiển thị không được trống';
    }
    if (!form.legalBasis.trim()) {
      errors.legalBasis = 'Căn cứ pháp lý không được trống';
    }
    if (!form.documentNumber.trim()) {
      errors.documentNumber = 'Số/ký hiệu văn bản không được trống';
    }
    if (form.reason.trim().length < 20) {
      errors.reason = 'Lý do đề xuất phải có ít nhất 20 ký tự';
    }
    // Optional documentUrl: only submit if present + parses as URL with public TLD.
    // Server re-validates strictly; this catches obvious mistakes before round-trip.
    let documentUrl: string | undefined;
    if (form.documentUrl.trim()) {
      try {
        const u = new URL(form.documentUrl.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          errors.documentUrl = 'URL phải bắt đầu bằng http:// hoặc https://';
        } else if (!u.hostname.includes('.')) {
          errors.documentUrl = 'URL phải có tên miền hợp lệ (vd: vbpl.vn)';
        } else {
          documentUrl = form.documentUrl.trim();
        }
      } catch {
        errors.documentUrl = 'URL không hợp lệ';
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError(null);
      // Scroll first failing field into view so the error is impossible to miss.
      const firstKey = (Object.keys(errors) as Array<keyof FormState>)[0];
      const testid = FIELD_TESTID_MAP[firstKey];
      if (testid && typeof document !== 'undefined') {
        document.querySelector(`[data-testid="${testid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }
    setFieldErrors({});
    setSubmitError(null);
    return {
      ruleKey: ruleKeyForSubmit,
      value: valueNum,
      label: form.label.trim(),
      legalBasis: form.legalBasis.trim(),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      documentIssuer: form.documentIssuer,
      documentDate: form.documentDate || undefined,
      documentUrl,
      reason: form.reason.trim(),
      effectiveFrom: form.effectiveFrom || undefined,
    };
  };

  // Clears the field-level error for `key` on every keystroke so the red state
  // doesn't linger after the user fixed the input.
  const updateField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (fieldErrors[k]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  };

  const applyPrefillHint = () => {
    if (!prefillHint) return;
    setForm((prev) => ({
      ...prev,
      documentType: prefillHint.docType,
      documentNumber: prefillHint.number,
      documentIssuer: prefillHint.issuer,
      documentDate: prefillHint.date,
      documentUrl: prefillHint.url,
    }));
    setBannerDismissed(true);
  };

  const handleSaveDraft = () => {
    const input = validate();
    if (input) saveDraftMut.mutate(input);
  };

  const handleSubmit = () => {
    const input = validate();
    if (input) submitMut.mutate(input);
  };

  const isLoading = isEditMode ? false : activeQ.isLoading;
  const isPending = saveDraftMut.isPending || submitMut.isPending;
  const unit = DEADLINE_RULE_KEY_UNIT[ruleKeyForSubmit] ?? 'ngày';
  const pageTitle = isEditMode ? 'Sửa bản nháp đề xuất' : 'Đề xuất sửa quy tắc';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="propose-rule-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800" data-testid="page-title">{pageTitle}</h1>
        <p className="text-slate-600 text-sm mt-1">
          <span className="font-mono text-blue-700">{ruleKeyForSubmit}</span> —{' '}
          {DEADLINE_RULE_KEY_LABEL[ruleKeyForSubmit] ?? 'Quy tắc thời hạn'}
        </p>
      </div>

      {/* Approver's request-changes note pinned above the form in edit mode.
          Cleared by backend submit() when proposer resubmits (C2 fix). */}
      {requestChangesNote && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3"
          data-testid="request-changes-banner"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">Approver yêu cầu sửa đổi</p>
            <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">{requestChangesNote}</p>
            <p className="text-xs text-amber-700 mt-2 italic">
              Sửa theo ghi chú trên và gửi duyệt lại. Ghi chú sẽ tự xóa khi bạn submit.
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2" data-testid="submit-error">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {prefillHint && !bannerDismissed && (
        <div
          role="status"
          className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3"
          data-testid="prefill-banner"
        >
          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">Đề xuất giá trị từ migration hints</p>
            <p className="text-xs text-blue-700 mt-1">
              {prefillHint.docType} {prefillHint.number} · {prefillHint.issuer} · {prefillHint.date}
              {prefillHint.url && (
                <>
                  {' · '}
                  <span className="underline">{new URL(prefillHint.url).hostname}</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-blue-600 mt-1 italic">
              Áp dụng để pre-fill 4 trường văn bản. Bạn có thể sửa sau khi áp dụng.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={applyPrefillHint}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"
              data-testid="prefill-apply"
            >
              Dùng đề xuất
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
              title="Bỏ qua"
              data-testid="prefill-dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        {/* Giá trị (hero field) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Giá trị mới <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={3650}
              value={form.value}
              onChange={(e) => updateField('value', e.target.value)}
              className={`w-32 px-3 py-2 border rounded text-2xl font-mono font-bold text-center focus:outline-none focus:ring-2 ${fieldErrors.value ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
              data-testid="input-value"
              disabled={isLoading}
            />
            <span className="text-slate-600">{unit}</span>
          </div>
          {fieldErrors.value && (
            <p data-testid="error-value" className="text-xs text-red-600 mt-1">{fieldErrors.value}</p>
          )}
        </div>

        {/* effectiveFrom */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ngày hiệu lực
          </label>
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="input-effective-from"
          />
          <p className="text-xs text-slate-500 mt-1">
            Để trống = áp dụng ngay sau khi duyệt. Tối đa 2 năm trong tương lai.
          </p>
        </div>

        {/* label */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tên hiển thị <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => updateField('label', e.target.value)}
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${fieldErrors.label ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
            maxLength={200}
            data-testid="input-label"
          />
          {fieldErrors.label && (
            <p data-testid="error-label" className="text-xs text-red-600 mt-1">{fieldErrors.label}</p>
          )}
        </div>

        {/* legalBasis */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Căn cứ pháp lý <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.legalBasis}
            onChange={(e) => updateField('legalBasis', e.target.value)}
            placeholder="Vd: Điều 147 BLTTHS 2015 (sửa đổi 2021)"
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${fieldErrors.legalBasis ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
            maxLength={500}
            data-testid="input-legal-basis"
          />
          {fieldErrors.legalBasis && (
            <p data-testid="error-legal-basis" className="text-xs text-red-600 mt-1">{fieldErrors.legalBasis}</p>
          )}
        </div>

        {/* documentRef (structured) */}
        <fieldset className="border border-slate-200 rounded-lg p-4">
          <legend className="text-sm font-medium text-slate-700 px-2">
            Văn bản pháp luật làm căn cứ <span className="text-red-500">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Loại văn bản</label>
              <select
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                className="w-full px-2 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="select-doc-type"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Số/ký hiệu</label>
              <input
                type="text"
                value={form.documentNumber}
                onChange={(e) => updateField('documentNumber', e.target.value)}
                placeholder="Vd: 28/2020"
                className={`w-full px-2 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${fieldErrors.documentNumber ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                maxLength={100}
                data-testid="input-doc-number"
              />
              {fieldErrors.documentNumber && (
                <p data-testid="error-doc-number" className="text-xs text-red-600 mt-1">{fieldErrors.documentNumber}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Cơ quan ban hành</label>
              <select
                value={form.documentIssuer}
                onChange={(e) => setForm({ ...form, documentIssuer: e.target.value })}
                className="w-full px-2 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="select-doc-issuer"
              >
                {DOCUMENT_ISSUERS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-slate-600 mb-1">Ngày ban hành (tùy chọn)</label>
            <input
              type="date"
              value={form.documentDate}
              onChange={(e) => setForm({ ...form, documentDate: e.target.value })}
              className="px-2 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-doc-date"
            />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <DocumentUrlInput
              value={form.documentUrl}
              onChange={(url) => setForm({ ...form, documentUrl: url })}
              disabled={isPending}
            />
          </div>
        </fieldset>

        {/* reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Lý do đề xuất <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => updateField('reason', e.target.value)}
            rows={5}
            placeholder="Vd: Cập nhật theo Thông tư 28/2020/TT-BCA Điều 11 khoản 2 do BCA mới ban hành thay thế quy định cũ..."
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${fieldErrors.reason ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
            minLength={20}
            maxLength={2000}
            data-testid="input-reason"
          />
          {fieldErrors.reason ? (
            <p data-testid="error-reason" className="text-xs text-red-600 mt-1">{fieldErrors.reason}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Tối thiểu 20 ký tự — phục vụ audit VKS.</p>
          )}
        </div>
      </div>

      {/* Sticky form-error summary — sits directly above the button cluster
          so a click that fails validation cannot disappear into the void.
          Counts errors only; specific messages appear inline below each input
          so we don't duplicate text that breaks getByText regex assertions. */}
      {(submitError || Object.keys(fieldErrors).length > 0) && (
        <div
          data-testid="form-error-summary"
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            {submitError ?? (
              <span>
                Có <span className="font-medium">{Object.keys(fieldErrors).length}</span> trường cần sửa bên trên trước khi gửi.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isPending}
          className="flex items-center gap-1 px-4 py-2 text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 rounded disabled:opacity-50"
          data-testid="btn-save-draft"
        >
          {saveDraftMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu nháp
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
          data-testid="btn-submit"
        >
          {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Gửi duyệt ngay
        </button>
      </div>
    </div>
  );
}
