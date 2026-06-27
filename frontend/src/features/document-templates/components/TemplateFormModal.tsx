import { useState } from 'react';
import { createTemplate } from '../api';

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'VU_AN', label: 'Vụ án' },
  { value: 'VU_VIEC', label: 'Vụ việc' },
  { value: 'DON_THU', label: 'Đơn thư' },
];
const CATEGORY_OPTIONS = ['Quyết định', 'Biên bản', 'Lệnh', 'Thông báo', 'Giấy chứng nhận', 'Khác'];

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

/** Modal admin: upload .docx + khai báo entity/category/cấp số → tạo template động. */
export function TemplateFormModal({ onClose, onSaved }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('VU_AN');
  const [category, setCategory] = useState('Quyết định');
  const [needsNumber, setNeedsNumber] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = !!file && code.trim() !== '' && name.trim() !== '' && !saving;

  async function handleSave() {
    if (!canSave || !file) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('code', code.trim());
      form.append('name', name.trim());
      form.append('entityType', entityType);
      form.append('category', category);
      form.append('needsNumber', String(needsNumber));
      form.append('sortOrder', String(sortOrder));
      form.append('file', file);
      await createTemplate(form);
      onSaved();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Lưu mẫu thất bại';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="template-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Thêm mẫu chứng từ</h2>

        <label className="mb-1 block text-sm font-medium">Mã mẫu *</label>
        <input
          data-testid="template-code-input"
          className="mb-3 w-full rounded border px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="VD: QD-KTVA"
        />

        <label className="mb-1 block text-sm font-medium">Tên mẫu *</label>
        <input
          data-testid="template-name-input"
          className="mb-3 w-full rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Quyết định khởi tố vụ án"
        />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Loại hồ sơ *</label>
            <select
              data-testid="template-entity-select"
              className="w-full rounded border px-3 py-2"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Danh mục *</label>
            <select
              data-testid="template-category-select"
              className="w-full rounded border px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium">File mẫu (.docx) *</label>
        <input
          data-testid="template-file-input"
          type="file"
          accept=".docx"
          className="mb-3 w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="mb-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="template-needs-number"
              type="checkbox"
              checked={needsNumber}
              onChange={(e) => setNeedsNumber(e.target.checked)}
            />
            Cấp số văn bản
          </label>
          <label className="flex items-center gap-2 text-sm">
            Thứ tự
            <input
              data-testid="template-sort-order"
              type="number"
              className="w-20 rounded border px-2 py-1"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        {error && (
          <p data-testid="template-form-error" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-template"
            type="button"
            className="rounded border px-4 py-2"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            data-testid="btn-save-template"
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={!canSave}
            onClick={handleSave}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
