import { useState, useId } from 'react';
import { Check, AlertCircle } from 'lucide-react';

/**
 * Known legal-source domains. Mirrors `backend/src/deadline-rules/constants/
 * law-source-hints.constants.ts` LAW_SOURCE_HINTS — kept in sync manually
 * because the frontend doesn't need full server import. If list grows beyond
 * ~10 entries, generate from the backend constant via npm script.
 */
interface LawSourceHint {
  domain: string;
  label: string;
  official: boolean;
}

const LAW_SOURCE_HINTS: LawSourceHint[] = [
  { domain: 'vbpl.vn',            label: 'Cơ sở dữ liệu pháp luật quốc gia', official: true  },
  { domain: 'chinhphu.vn',        label: 'Cổng Chính phủ',                   official: true  },
  { domain: 'quochoi.vn',         label: 'Quốc hội Việt Nam',                official: true  },
  { domain: 'vksndtc.gov.vn',     label: 'Viện kiểm sát ND tối cao',         official: true  },
  { domain: 'tandtc.gov.vn',      label: 'Tòa án ND tối cao',                official: true  },
  { domain: 'thuvienphapluat.vn', label: 'Thư viện Pháp luật (tham khảo)',   official: false },
];

interface ValidationResult {
  valid: boolean;
  hint?: LawSourceHint;
}

/**
 * Mirrors backend `assertDocumentUrlSafe` rules so the client gives immediate
 * feedback that matches what the server will accept. Defense-in-depth means
 * the server validates again; this is purely UX.
 */
function validateUrl(input: string): ValidationResult {
  if (!input) return { valid: true }; // optional — empty is fine
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { valid: false };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { valid: false };
  if (!url.hostname.includes('.')) return { valid: false };
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0'
  ) {
    return { valid: false };
  }
  const hint = LAW_SOURCE_HINTS.find((h) => host === h.domain || host.endsWith(`.${h.domain}`));
  return { valid: true, hint };
}

interface DocumentUrlInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

/**
 * Optional URL input for proposing a deadline rule version. Renders blur-time
 * inline ✓ (green) / ⚠ (red) feedback, plus a domain-match chip when the URL
 * resolves to a known law source. Empty value is valid (field is optional).
 *
 * Submission flow: parent owns `value` state and passes to `DTO.documentUrl`.
 * The backend re-validates with stricter `assertDocumentUrlSafe`; this UI
 * just gives faster feedback. Never trust client validation alone.
 */
export function DocumentUrlInput({ value, onChange, disabled }: DocumentUrlInputProps) {
  const [touched, setTouched] = useState(false);
  const result = validateUrl(value);
  const showError = touched && Boolean(value) && !result.valid;
  const showHint = touched && Boolean(value) && result.valid && result.hint;

  // Stable IDs for aria-describedby. useId is React 18+ and avoids hydration mismatch.
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="space-y-1.5" data-testid="document-url-field">
      <label htmlFor={inputId} className="block text-xs font-medium text-slate-600">
        URL tham khảo (tùy chọn)
      </label>
      <input
        id={inputId}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        disabled={disabled}
        placeholder="https://vbpl.vn/..."
        aria-invalid={showError ? 'true' : 'false'}
        aria-describedby={showError ? errorId : showHint ? hintId : undefined}
        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 ${
          showError
            ? 'border-red-300 focus:ring-red-500'
            : 'border-slate-300 focus:ring-blue-500'
        }`}
        data-testid="document-url-input"
      />
      {showError && (
        <p id={errorId} role="alert" className="text-xs text-red-600 flex items-center gap-1" data-testid="document-url-error">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          URL phải bắt đầu bằng http(s):// và là tên miền công khai hợp lệ
        </p>
      )}
      {showHint && result.hint && (
        <p id={hintId} className="text-xs text-green-700 flex items-center gap-1 flex-wrap" data-testid="document-url-hint">
          <Check className="w-3 h-3 flex-shrink-0" />
          <span>{result.hint.label}</span>
          {!result.hint.official && (
            <span className="text-amber-600" data-testid="document-url-non-official">
              (không phải nguồn chính thức)
            </span>
          )}
        </p>
      )}
      {!touched && !value && (
        <p className="text-xs text-slate-500">
          Gợi ý nguồn chính thức: vbpl.vn · chinhphu.vn · quochoi.vn
        </p>
      )}
    </div>
  );
}
