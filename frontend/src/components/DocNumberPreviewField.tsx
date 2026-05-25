import { useState } from 'react';

interface Props {
  inputMode: 'AUTO' | 'MANUAL' | 'AUTO_WITH_OVERRIDE';
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function DocNumberPreviewField({ inputMode, value, onChange, loading, placeholder }: Props) {
  const [overrideActive, setOverrideActive] = useState(false);

  if (inputMode === 'MANUAL') {
    return (
      <input
        type="text"
        className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  if (inputMode === 'AUTO_WITH_OVERRIDE' && overrideActive) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded border bg-amber-50"
        style={{ borderColor: 'var(--docnum-override-border)' }}
      >
        <span
          className="text-xs"
          style={{ color: 'var(--docnum-override-text)' }}
          aria-label="override-active"
        >
          ✎
        </span>
        <input
          type="text"
          className="flex-1 text-sm font-mono bg-transparent outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
      </div>
    );
  }

  // AUTO or AUTO_WITH_OVERRIDE (locked state)
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 bg-gray-50 flex-1 min-w-0">
        <span className="text-gray-400 flex-shrink-0 text-xs">🔒</span>
        {loading ? (
          <span
            data-testid="docnum-loading"
            className="text-sm text-gray-400 animate-pulse flex-1"
          >
            Đang tải…
          </span>
        ) : (
          <span
            data-testid="docnum-preview-value"
            className="text-sm font-mono text-gray-800 flex-1 truncate"
          >
            {value || '—'}
          </span>
        )}
        <span
          data-testid="docnum-auto-badge"
          className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{
            background: 'var(--docnum-auto-bg)',
            color: 'var(--docnum-auto-text)',
          }}
        >
          Tự động
        </span>
      </div>

      {inputMode === 'AUTO_WITH_OVERRIDE' && (
        <button
          type="button"
          data-testid="docnum-override-btn"
          className="flex items-center gap-1 px-2 py-2 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50 flex-shrink-0"
          onClick={() => setOverrideActive(true)}
        >
          <span>✎</span>
          <span>Nhập tay</span>
        </button>
      )}
    </div>
  );
}

export default DocNumberPreviewField;
