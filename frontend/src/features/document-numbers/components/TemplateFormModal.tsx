import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SegmentBuilder } from './SegmentBuilder';
import type { DocumentNumberTemplate, TemplateSegment, CounterConfig, CreateTemplateInput } from '../types';

const DOCUMENT_TYPES = [
  'INCIDENT',
  'PETITION',
  'CASE',
  'PROPOSAL',
  'DELEGATION',
  'EVIDENCE',
];

const RESET_PERIOD_OPTIONS = [
  { value: 'YEARLY', label: 'Hàng năm' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'WEEKLY', label: 'Hàng tuần' },
  { value: 'NEVER', label: 'Không reset' },
  { value: 'MAX_NUMBER', label: 'Reset khi đạt max' },
];

const INPUT_MODE_OPTIONS = [
  { value: 'AUTO', label: 'Tự động' },
  { value: 'MANUAL', label: 'Nhập tay' },
  { value: 'AUTO_WITH_OVERRIDE', label: 'Tự động (cho phép override)' },
];

const DEFAULT_SEGMENTS: TemplateSegment[] = [
  { type: 'LITERAL', value: '' },
  { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
  { type: 'COUNTER' },
];

const DEFAULT_COUNTER_CONFIG: CounterConfig = {
  resetPeriod: 'YEARLY',
  minValue: 1,
  maxValue: 99999,
  padding: 5,
};

interface Props {
  template: DocumentNumberTemplate | null;
  onClose: () => void;
  onSave: (data: CreateTemplateInput, id?: string) => Promise<void>;
  isSaving: boolean;
}

export function TemplateFormModal({ template, onClose, onSave, isSaving }: Props) {
  const isEdit = !!template;

  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('INCIDENT');
  const [customDocType, setCustomDocType] = useState('');
  const [separator, setSeparator] = useState('-');
  const [inputMode, setInputMode] = useState('AUTO');
  const [isActive, setIsActive] = useState(true);
  const [segments, setSegments] = useState<TemplateSegment[]>(DEFAULT_SEGMENTS);
  const [counterConfig, setCounterConfig] = useState<CounterConfig>(DEFAULT_COUNTER_CONFIG);

  useEffect(() => {
    if (template) {
      setName(template.name);
      const isKnown = DOCUMENT_TYPES.includes(template.documentType);
      setDocumentType(isKnown ? template.documentType : '__custom__');
      setCustomDocType(isKnown ? '' : template.documentType);
      setSeparator(template.separator);
      setInputMode(template.inputMode);
      setIsActive(template.isActive);
      setSegments(template.segments);
      setCounterConfig(template.counterConfig);
    }
  }, [template]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedDocType = documentType === '__custom__' ? customDocType.trim() : documentType;
    if (!resolvedDocType) return;

    const data: CreateTemplateInput = {
      name: name.trim(),
      documentType: resolvedDocType,
      separator,
      inputMode,
      isActive,
      segments,
      counterConfig,
    };

    await onSave(data, template?.id);
  }

  function updateCounter(patch: Partial<CounterConfig>) {
    setCounterConfig((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? `Sửa template: ${template.name}` : 'Tạo template mới'}
          </h2>
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="template-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Mã vụ việc"
            />
          </div>

          {/* Loại chứng từ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại chứng từ</label>
            {isEdit ? (
              <input
                type="text"
                readOnly
                className="w-full px-3 py-2 text-sm border rounded bg-gray-50 text-gray-500"
                value={template.documentType}
              />
            ) : (
              <div className="flex gap-2">
                <select
                  className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                  <option value="__custom__">Tùy chỉnh…</option>
                </select>
                {documentType === '__custom__' && (
                  <input
                    type="text"
                    required
                    className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={customDocType}
                    onChange={(e) => setCustomDocType(e.target.value)}
                    placeholder="Loại chứng từ tùy chỉnh"
                  />
                )}
              </div>
            )}
          </div>

          {/* Separator + InputMode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ký tự phân cách
                <span className="text-xs text-gray-400 ml-1">(để trống = không phân cách)</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                placeholder="-"
                maxLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chế độ nhập</label>
              <select
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={inputMode}
                onChange={(e) => setInputMode(e.target.value)}
              >
                {INPUT_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="template-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="template-active" className="text-sm text-gray-700">
              Kích hoạt template
            </label>
          </div>

          {/* Segments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quy tắc sinh số</label>
            <SegmentBuilder
              segments={segments}
              onChange={setSegments}
              separator={separator}
            />
          </div>

          {/* Counter Config */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cấu hình số tự tăng</label>
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded border">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chu kỳ reset</label>
                <select
                  className="w-full px-2 py-1.5 text-sm border rounded bg-white"
                  value={counterConfig.resetPeriod}
                  onChange={(e) => updateCounter({ resetPeriod: e.target.value as CounterConfig['resetPeriod'] })}
                >
                  {RESET_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Độ dài tối thiểu (padding)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full px-2 py-1.5 text-sm border rounded"
                  value={counterConfig.padding}
                  onChange={(e) => updateCounter({ padding: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Giá trị tối thiểu</label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-2 py-1.5 text-sm border rounded"
                  value={counterConfig.minValue}
                  onChange={(e) => updateCounter({ minValue: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Giá trị tối đa</label>
                <input
                  type="number"
                  min={1}
                  className="w-full px-2 py-1.5 text-sm border rounded"
                  value={counterConfig.maxValue}
                  onChange={(e) => updateCounter({ maxValue: parseInt(e.target.value) || 99999 })}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50"
            onClick={onClose}
            disabled={isSaving}
          >
            Hủy
          </button>
          <button
            type="submit"
            form="template-form"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo template'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateFormModal;
