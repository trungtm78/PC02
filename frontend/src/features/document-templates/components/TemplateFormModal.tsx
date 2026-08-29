import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  createTemplate,
  detectVariables,
  getFieldCatalog,
  updateTemplate,
  replaceTemplateFile,
} from '../api';
import type { DocumentTemplate, FieldCatalogItem, TemplateVariable } from '../types';
import { documentNumbersApi } from '@/features/document-numbers/api';
import type { DocumentNumberTemplate } from '@/features/document-numbers/types';

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'VU_AN', label: 'Vụ án' },
  { value: 'VU_VIEC', label: 'Vụ việc' },
  { value: 'DON_THU', label: 'Đơn thư' },
];
const ENTITY_LABEL: Record<string, string> = Object.fromEntries(
  ENTITY_OPTIONS.map((o) => [o.value, o.label]),
);
const CATEGORY_OPTIONS = ['Quyết định', 'Biên bản', 'Lệnh', 'Thông báo', 'Giấy chứng nhận', 'Kết luận', 'Khác'];

/** Preset ký tự mở/đóng placeholder. 2 ký tự (`[[ ]]`, `«»`) ít bị Word tách run hơn. */
const DELIM_PRESETS: { label: string; start: string; end: string }[] = [
  { label: '{ }', start: '{', end: '}' },
  { label: '{{ }}', start: '{{', end: '}}' },
  { label: '[[ ]]', start: '[[', end: ']]' },
  { label: '« »', start: '«', end: '»' },
  { label: 'Tùy chỉnh', start: '', end: '' },
];

function presetIndexFor(start: string, end: string): number {
  const i = DELIM_PRESETS.findIndex((p) => p.start === start && p.end === end);
  return i >= 0 ? i : DELIM_PRESETS.length - 1; // custom
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  /** Có => chế độ SỬA (pre-fill, PATCH). Không => TẠO MỚI. */
  template?: DocumentTemplate;
}

/** Modal admin: tạo/sửa template động — upload .docx + chọn delimiter + map placeholder→field (no-code). */
export function TemplateFormModal({ onClose, onSaved, template }: Props) {
  const isEdit = !!template;
  const [code, setCode] = useState(template?.code ?? '');
  const [name, setName] = useState(template?.name ?? '');
  const [entityType, setEntityType] = useState<string>(template?.entityType ?? 'VU_AN');
  const [category, setCategory] = useState(template?.category ?? 'Quyết định');
  const [needsNumber, setNeedsNumber] = useState(template?.needsNumber ?? false);
  const [selectedByDefault, setSelectedByDefault] = useState(template?.selectedByDefault ?? false);
  const [numberSeriesId, setNumberSeriesId] = useState(template?.numberSeriesId ?? '');
  const [seriesOptions, setSeriesOptions] = useState<DocumentNumberTemplate[]>([]);
  const [sortOrder, setSortOrder] = useState(template?.sortOrder ?? 0);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initStart = template?.delimStart ?? '{';
  const initEnd = template?.delimEnd ?? '}';
  const [presetIdx, setPresetIdx] = useState(presetIndexFor(initStart, initEnd));
  const [delimStart, setDelimStart] = useState(initStart);
  const [delimEnd, setDelimEnd] = useState(initEnd);

  // Mapping biến + danh mục field. Edit: khởi từ template.variables.
  const [variables, setVariables] = useState<TemplateVariable[]>(template?.variables ?? []);
  const [catalog, setCatalog] = useState<FieldCatalogItem[]>([]);
  const [detecting, setDetecting] = useState(false);

  // Đổi delimiter chỉ cho phép khi tạo mới hoặc khi đã chọn file mới (cần detect lại).
  const delimLocked = isEdit && !file;

  useEffect(() => {
    documentNumbersApi.listTemplates().then(setSeriesOptions).catch(() => setSeriesOptions([]));
  }, []);

  // Danh mục field theo loại hồ sơ. Guard chống response cũ resolve sau.
  useEffect(() => {
    let cancelled = false;
    getFieldCatalog(entityType)
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  // Detect khi có FILE MỚI. Edit không file mới → giữ nguyên mapping của template.
  useEffect(() => {
    if (!file) {
      if (!isEdit) setVariables([]);
      return;
    }
    if (!delimStart || !delimEnd) return;
    let cancelled = false;
    setDetecting(true);
    setError('');
    detectVariables(file, entityType, delimStart, delimEnd)
      .then((r) => {
        if (!cancelled) setVariables(r.suggested);
      })
      .catch(() => {
        if (!cancelled) {
          setVariables([]);
          setError('Không phát hiện được biến (kiểm tra file/ký tự mở-đóng).');
        }
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, entityType, delimStart, delimEnd, isEdit]);

  function applyPreset(idx: number) {
    setPresetIdx(idx);
    const p = DELIM_PRESETS[idx];
    if (p.start) {
      setDelimStart(p.start);
      setDelimEnd(p.end);
    }
  }

  function updateVar(i: number, patch: Partial<TemplateVariable>) {
    setVariables((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  const canSave =
    (isEdit || !!file) &&
    code.trim() !== '' &&
    name.trim() !== '' &&
    delimStart !== '' &&
    delimEnd !== '' &&
    delimStart !== delimEnd &&
    delimStart.length <= 8 &&
    delimEnd.length <= 8 &&
    (!needsNumber || numberSeriesId !== '') &&
    !detecting &&
    !saving &&
    variables.every((v) => v.source !== 'auto' || !!v.field);

  function parseErr(e: unknown): string {
    return (
      (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
        ?.message ?? 'Lưu mẫu thất bại'
    );
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      if (isEdit && template) {
        if (file) await replaceTemplateFile(template.id, file);
        await updateTemplate(template.id, {
          name: name.trim(),
          category,
          needsNumber,
          selectedByDefault,
          numberSeriesId: needsNumber ? numberSeriesId : null,
          sortOrder,
          delimStart,
          delimEnd,
          variables,
        });
      } else {
        if (!file) return;
        const form = new FormData();
        form.append('code', code.trim());
        form.append('name', name.trim());
        form.append('entityType', entityType);
        form.append('category', category);
        form.append('needsNumber', String(needsNumber));
        form.append('selectedByDefault', String(selectedByDefault));
        if (needsNumber && numberSeriesId) form.append('numberSeriesId', numberSeriesId);
        form.append('sortOrder', String(sortOrder));
        form.append('delimStart', delimStart);
        form.append('delimEnd', delimEnd);
        form.append('variables', JSON.stringify(variables));
        form.append('file', file);
        await createTemplate(form);
      }
      onSaved();
    } catch (e: unknown) {
      setError(parseErr(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="template-form-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? 'Sửa mẫu chứng từ' : 'Thêm mẫu chứng từ'}
        </h2>

        <label className="mb-1 block text-sm font-medium">Mã mẫu *</label>
        <input
          data-testid="template-code-input"
          className="mb-3 w-full rounded border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
          value={code}
          disabled={isEdit}
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
            {isEdit ? (
              <input
                data-testid="template-entity-readonly"
                className="w-full rounded border bg-slate-100 px-3 py-2 text-slate-500"
                value={ENTITY_LABEL[entityType] ?? entityType}
                disabled
              />
            ) : (
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
            )}
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

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium">Ký tự mở/đóng placeholder *</label>
          <select
            data-testid="template-delim-preset"
            className="w-full rounded border px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
            value={presetIdx}
            disabled={delimLocked}
            onChange={(e) => applyPreset(Number(e.target.value))}
          >
            {DELIM_PRESETS.map((p, idx) => (
              <option key={p.label} value={idx}>
                {p.label}
              </option>
            ))}
          </select>
          {DELIM_PRESETS[presetIdx].start === '' && (
            <div className="mt-2 flex gap-2">
              <input
                data-testid="template-delim-start"
                className="w-1/2 rounded border px-3 py-2"
                value={delimStart}
                maxLength={8}
                disabled={delimLocked}
                onChange={(e) => setDelimStart(e.target.value)}
                placeholder="mở (vd [[)"
              />
              <input
                data-testid="template-delim-end"
                className="w-1/2 rounded border px-3 py-2"
                value={delimEnd}
                maxLength={8}
                disabled={delimLocked}
                onChange={(e) => setDelimEnd(e.target.value)}
                placeholder="đóng (vd ]])"
              />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {delimLocked
              ? 'Đổi ký tự cần chọn file mới (để phát hiện lại biến).'
              : 'Mẹo: ký tự 2 chữ ([[ ]], « ») ổn định hơn cho placeholder tiếng Việt có dấu.'}
          </p>
        </div>

        <label className="mb-1 block text-sm font-medium">
          File mẫu (.docx) {isEdit ? '' : '*'}
        </label>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 ${
              saving ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <Upload className="h-4 w-4" />
            {isEdit ? 'Chọn file mới (tùy chọn)' : 'Chọn file .docx'}
            <input
              data-testid="template-file-input"
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file ? (
            <span data-testid="template-file-name" className="text-sm text-slate-700">
              {file.name} ✓
            </span>
          ) : (
            isEdit && (
              <span className="text-sm text-slate-500">Hiện tại: {template?.fileName}</span>
            )
          )}
        </div>

        {/* Thuộc tính của MẪU đặt trước danh sách biến: danh sách biến dài không giới hạn
            (có mẫu 40 dòng), nên bất cứ ô nào đặt sau nó đều bị đẩy khỏi tầm nhìn lúc Sửa —
            đúng lỗi 29/08: "tạo mới có ô tích sẵn, bấm Sửa thì không thấy đâu". */}
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
          {/* Mẫu này có được tích sẵn ở popup In chứng từ không. Tắt hết là popup mở ra trống,
              cán bộ tích đúng thứ cần — thay vì nhận 14 tệp Word mỗi lần bấm xuất. */}
          <label className="flex items-center gap-2 text-sm">
            <input
              data-testid="template-selected-by-default"
              type="checkbox"
              checked={selectedByDefault}
              onChange={(e) => setSelectedByDefault(e.target.checked)}
            />
            Tích sẵn khi in
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

        {needsNumber && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">Chuỗi số văn bản *</label>
            <select
              data-testid="template-number-series"
              className="w-full rounded border px-3 py-2"
              value={numberSeriesId ?? ''}
              onChange={(e) => setNumberSeriesId(e.target.value)}
            >
              <option value="">-- Chọn chuỗi số --</option>
              {seriesOptions.map((o) => (
                <option key={o.id} value={o.documentType}>
                  {o.name} ({o.documentType})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Bắt buộc khi bật cấp số — mỗi lần in sẽ cấp 1 số từ chuỗi này.
            </p>
          </div>
        )}

        {/* Map biến → field (no-code) */}
        {(file || (isEdit && variables.length > 0)) && (
          <div className="mb-3 rounded border border-slate-200 p-3">
            <div className="mb-2 text-sm font-medium">
              Khai báo biến {detecting && <span className="text-slate-400">(đang phát hiện…)</span>}
            </div>
            {!detecting && variables.length === 0 && (
              <p className="text-xs text-slate-400">Chưa phát hiện placeholder nào trong file.</p>
            )}
            {variables.map((v, i) => (
              <div
                key={v.name}
                data-testid={`var-row-${v.name}`}
                className="mb-2 grid grid-cols-12 items-center gap-2 text-sm"
              >
                <code className="col-span-3 truncate" title={v.name}>
                  {v.name}
                </code>
                <select
                  data-testid={`var-source-${v.name}`}
                  className="col-span-3 rounded border px-2 py-1"
                  value={v.source}
                  onChange={(e) =>
                    updateVar(i, {
                      source: e.target.value as 'auto' | 'manual',
                      field: e.target.value === 'manual' ? undefined : v.field,
                    })
                  }
                >
                  <option value="auto">Tự điền</option>
                  <option value="manual">Nhập tay</option>
                </select>
                {v.source === 'auto' ? (
                  <select
                    data-testid={`var-field-${v.name}`}
                    className="col-span-3 rounded border px-2 py-1"
                    value={v.field ?? ''}
                    onChange={(e) => updateVar(i, { field: e.target.value || undefined })}
                  >
                    <option value="">-- chọn trường --</option>
                    {catalog.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-testid={`var-label-${v.name}`}
                    className="col-span-3 rounded border px-2 py-1"
                    value={v.label}
                    onChange={(e) => updateVar(i, { label: e.target.value })}
                    placeholder="Nhãn hiển thị"
                  />
                )}
                <label className="col-span-3 flex items-center gap-1 text-xs">
                  <input
                    data-testid={`var-required-${v.name}`}
                    type="checkbox"
                    checked={v.required ?? false}
                    onChange={(e) => updateVar(i, { required: e.target.checked })}
                  />
                  Bắt buộc
                </label>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p data-testid="template-form-error" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 rounded-b-lg border-t border-slate-200 bg-white px-5 py-3">
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
            {isEdit ? 'Lưu thay đổi' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
