import { useState } from 'react';
import { updateTemplate } from '../api';
import type { DocumentTemplate } from '../types';

/**
 * Modal admin khai báo biến BẮT BUỘC khi in cho 1 mẫu chứng từ động.
 * Tick biến → readiness popup "In chứng từ" sẽ báo "Thiếu" + cho bổ sung nếu hồ sơ chưa có.
 * Gửi `requiredVariables` (mảng tên biến) → PATCH /document-templates/:id (backend set cờ required).
 */
interface Props {
  template: DocumentTemplate;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateRequiredModal({ template, onClose, onSaved }: Props) {
  const [required, setRequired] = useState<Set<string>>(
    () => new Set((template.variables ?? []).filter((v) => v.required).map((v) => v.name)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (name: string) =>
    setRequired((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplate(template.id, { requiredVariables: [...required] });
      onSaved();
    } catch {
      setError('Không lưu được cấu hình. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  const vars = template.variables ?? [];

  return (
    <div
      data-testid="template-required-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Cấu hình biến bắt buộc</h2>
        <p className="mt-1 text-sm text-slate-500">
          {template.code} — {template.name}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Tick biến bắt buộc: khi in mà hồ sơ chưa có thông tin, mẫu sẽ bị khoá và yêu cầu bổ sung.
        </p>

        <ul className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
          {vars.length === 0 && (
            <li className="px-3 py-3 text-sm text-slate-400" data-testid="template-required-empty">
              Mẫu này không có biến nào.
            </li>
          )}
          {vars.map((v) => (
            <li key={v.name}>
              <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-amber-50">
                <input
                  type="checkbox"
                  data-testid={`template-required-${v.name}`}
                  checked={required.has(v.name)}
                  onChange={() => toggle(v.name)}
                  className="h-4 w-4 accent-amber-600"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{v.label || v.name}</span>
                  <span className="block text-xs text-slate-500">
                    {v.name} · {v.source === 'auto' ? 'tự điền từ hồ sơ' : 'nhập tay khi in'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {error && (
          <div role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="template-required-cancel"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            data-testid="template-required-save"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateRequiredModal;
