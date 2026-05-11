import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, AlertCircle, Loader2 } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import {
  DOCUMENT_TYPES,
  DOCUMENT_ISSUERS,
  type ProposeRuleInput,
} from '@/features/deadline-rules/types';
import { DEADLINE_RULE_KEY_LABEL, DEADLINE_RULE_KEY_UNIT } from '@/shared/enums/status-labels';

interface FormState {
  value: string;
  label: string;
  legalBasis: string;
  documentType: string;
  documentNumber: string;
  documentIssuer: string;
  documentDate: string;
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
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Preload from active rule of this key
  const activeQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.active,
    queryFn: () => deadlineRulesApi.listActive(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!key || !activeQ.data) return;
    const current = activeQ.data.data.find((r) => r.ruleKey === key);
    if (current) {
      setForm((prev) => ({
        ...prev,
        value: String(current.value),
        label: current.label,
        legalBasis: current.legalBasis,
      }));
    }
  }, [key, activeQ.data]);

  const saveDraftMut = useMutation({
    mutationFn: (input: ProposeRuleInput) => deadlineRulesApi.propose(input),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.active });
      navigate(`/admin/deadline-rules/version/${res.data.id}`);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setError(e.response?.data?.message ?? e.message ?? 'Lưu thất bại'),
  });

  const submitMut = useMutation({
    mutationFn: async (input: ProposeRuleInput) => {
      const created = await deadlineRulesApi.propose(input);
      return deadlineRulesApi.submit(created.data.id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.active });
      queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.summary });
      navigate(`/admin/deadline-rules/version/${res.data.id}`);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setError(e.response?.data?.message ?? e.message ?? 'Gửi duyệt thất bại'),
  });

  if (!key) {
    return <div className="p-6 text-red-600">Thiếu mã quy tắc</div>;
  }

  const validate = (): ProposeRuleInput | null => {
    const valueNum = parseInt(form.value, 10);
    if (isNaN(valueNum) || valueNum < 1) {
      setError('Giá trị phải là số nguyên dương');
      return null;
    }
    if (!form.label.trim()) {
      setError('Tên hiển thị không được trống');
      return null;
    }
    if (!form.legalBasis.trim()) {
      setError('Căn cứ pháp lý không được trống');
      return null;
    }
    if (!form.documentNumber.trim()) {
      setError('Số/ký hiệu văn bản không được trống');
      return null;
    }
    if (form.reason.trim().length < 20) {
      setError('Lý do đề xuất phải có ít nhất 20 ký tự');
      return null;
    }
    setError(null);
    return {
      ruleKey: key,
      value: valueNum,
      label: form.label.trim(),
      legalBasis: form.legalBasis.trim(),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      documentIssuer: form.documentIssuer,
      documentDate: form.documentDate || undefined,
      reason: form.reason.trim(),
      effectiveFrom: form.effectiveFrom || undefined,
    };
  };

  const handleSaveDraft = () => {
    const input = validate();
    if (input) saveDraftMut.mutate(input);
  };

  const handleSubmit = () => {
    const input = validate();
    if (input) submitMut.mutate(input);
  };

  const isLoading = activeQ.isLoading;
  const isPending = saveDraftMut.isPending || submitMut.isPending;
  const unit = DEADLINE_RULE_KEY_UNIT[key] ?? 'ngày';

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
        <h1 className="text-2xl font-bold text-slate-800">Đề xuất sửa quy tắc</h1>
        <p className="text-slate-600 text-sm mt-1">
          <span className="font-mono text-blue-700">{key}</span> —{' '}
          {DEADLINE_RULE_KEY_LABEL[key] ?? 'Quy tắc thời hạn'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
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
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-32 px-3 py-2 border border-slate-300 rounded text-2xl font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-value"
              disabled={isLoading}
            />
            <span className="text-slate-600">{unit}</span>
          </div>
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
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={200}
            data-testid="input-label"
          />
        </div>

        {/* legalBasis */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Căn cứ pháp lý <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.legalBasis}
            onChange={(e) => setForm({ ...form, legalBasis: e.target.value })}
            placeholder="Vd: Điều 147 BLTTHS 2015 (sửa đổi 2021)"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={500}
            data-testid="input-legal-basis"
          />
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
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                placeholder="Vd: 28/2020"
                className="w-full px-2 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={100}
                data-testid="input-doc-number"
              />
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
        </fieldset>

        {/* reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Lý do đề xuất <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={5}
            placeholder="Vd: Cập nhật theo Thông tư 28/2020/TT-BCA Điều 11 khoản 2 do BCA mới ban hành thay thế quy định cũ..."
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            minLength={20}
            maxLength={2000}
            data-testid="input-reason"
          />
          <p className="text-xs text-slate-500 mt-1">Tối thiểu 20 ký tự — phục vụ audit VKS.</p>
        </div>
      </div>

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
