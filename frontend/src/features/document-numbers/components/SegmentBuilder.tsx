import { X } from 'lucide-react';
import type { TemplateSegment } from '../types';

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  LITERAL: 'Văn bản cố định',
  FORMULA: 'Công thức',
  COUNTER: 'Số tự tăng',
};

const SEGMENT_TYPE_CLASSES: Record<string, string> = {
  LITERAL: 'bg-blue-100 text-blue-700',
  FORMULA: 'bg-yellow-100 text-yellow-700',
  COUNTER: 'bg-green-100 text-green-700',
};

const SOURCE_OPTIONS = [
  { value: 'NOW', label: 'Ngày hiện tại' },
  { value: 'ctx:Login.workId', label: 'Mã cán bộ' },
  { value: 'ctx:Login.departmentId', label: 'Mã đơn vị ID' },
];

const PATTERN_HINTS: Record<string, string[]> = {
  NOW: ['YYYY', 'YY', 'MM', 'DD', 'YYYYMM', 'YYYYMMDD'],
};

interface Props {
  segments: TemplateSegment[];
  onChange: (segments: TemplateSegment[]) => void;
  separator?: string;
}

function segmentPreview(seg: TemplateSegment): string {
  if (seg.type === 'LITERAL') return seg.value ?? '?';
  if (seg.type === 'COUNTER') return '00001';
  if (seg.type === 'FORMULA') {
    if (seg.source === 'NOW') {
      if (seg.pattern === 'YYYY') return String(new Date().getFullYear());
      if (seg.pattern === 'MM') return String(new Date().getMonth() + 1).padStart(2, '0');
      if (seg.pattern === 'DD') return String(new Date().getDate()).padStart(2, '0');
      return seg.pattern ?? seg.source ?? '?';
    }
    return seg.source ?? '?';
  }
  return '?';
}

export function SegmentBuilder({ segments, onChange, separator = '-' }: Props) {
  function addSegment(type: TemplateSegment['type']) {
    const defaults: Record<string, Partial<TemplateSegment>> = {
      LITERAL: { type: 'LITERAL', value: '' },
      FORMULA: { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: 'YYYY' },
      COUNTER: { type: 'COUNTER' },
    };
    onChange([...segments, defaults[type] as TemplateSegment]);
  }

  function removeSegment(index: number) {
    onChange(segments.filter((_, i) => i !== index));
  }

  function updateSegment(index: number, patch: Partial<TemplateSegment>) {
    onChange(segments.map((seg, i) => (i === index ? { ...seg, ...patch } : seg)));
  }

  const preview = segments.map(segmentPreview).join(separator);

  return (
    <div className="space-y-3">
      {/* Segment list */}
      {segments.map((seg, i) => (
        <div
          key={i}
          data-testid={`segment-row-${i}`}
          className="flex items-start gap-3 p-3 bg-gray-50 rounded border"
        >
          <div className="flex-1 space-y-2">
            <span
              className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${SEGMENT_TYPE_CLASSES[seg.type] ?? ''}`}
            >
              {SEGMENT_TYPE_LABELS[seg.type] ?? seg.type}
            </span>

            {seg.type === 'LITERAL' && (
              <input
                type="text"
                className="w-full px-2 py-1 text-sm border rounded"
                value={seg.value ?? ''}
                onChange={(e) => updateSegment(i, { value: e.target.value })}
                placeholder="Giá trị (ví dụ: VV)"
              />
            )}

            {seg.type === 'FORMULA' && (
              <div className="flex gap-2">
                <select
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  value={seg.source ?? 'NOW'}
                  onChange={(e) => updateSegment(i, { source: e.target.value })}
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="w-24 px-2 py-1 text-sm border rounded"
                  value={seg.pattern ?? ''}
                  onChange={(e) => updateSegment(i, { pattern: e.target.value })}
                  placeholder="Pattern"
                  list={`pattern-hints-${i}`}
                />
                {PATTERN_HINTS[seg.source ?? ''] && (
                  <datalist id={`pattern-hints-${i}`}>
                    {PATTERN_HINTS[seg.source ?? ''].map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                )}
              </div>
            )}

            {seg.type === 'COUNTER' && (
              <p className="text-xs text-gray-400">Số tự tăng — cấu hình trong phần Counter bên dưới</p>
            )}
          </div>

          <button
            type="button"
            data-testid="segment-remove-btn"
            className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
            onClick={() => removeSegment(i)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Thêm đoạn:</span>
        <button
          type="button"
          data-testid="add-literal-btn"
          className="text-xs px-2 py-1 border rounded hover:bg-blue-50 text-blue-700 border-blue-200"
          onClick={() => addSegment('LITERAL')}
        >
          + Văn bản cố định
        </button>
        <button
          type="button"
          data-testid="add-formula-btn"
          className="text-xs px-2 py-1 border rounded hover:bg-yellow-50 text-yellow-700 border-yellow-200"
          onClick={() => addSegment('FORMULA')}
        >
          + Công thức
        </button>
        <button
          type="button"
          data-testid="add-counter-btn"
          className="text-xs px-2 py-1 border rounded hover:bg-green-50 text-green-700 border-green-200"
          onClick={() => addSegment('COUNTER')}
        >
          + Số tự tăng
        </button>
      </div>

      {/* Preview bar */}
      <div
        data-testid="segment-preview-bar"
        className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-100"
      >
        <span className="text-xs text-blue-600 font-medium flex-shrink-0">Preview:</span>
        <code className="text-sm font-mono text-blue-800">{preview || '—'}</code>
      </div>
    </div>
  );
}

export default SegmentBuilder;
