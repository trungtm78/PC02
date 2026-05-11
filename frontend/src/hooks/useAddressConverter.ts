import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { useShortcut } from './useShortcut';

// Reuse same setNativeValue pattern as useAbbreviationExpander (F9)
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Expand common Vietnamese address abbreviations to full forms BEFORE the
 * main regex runs. Uses `\p{L}` Unicode property escape so accented Vietnamese
 * letters like `ấ`, `Đ`, `ờ` participate in the word-boundary lookbehind —
 * `[A-Za-zĐđ]` was unsafe and could match inside accented words.
 *
 * Handles:
 *   - P3 / P.3 / P. 3 / P 3 / p3 / P03 → Phường 3
 *   - Q10 / Q.10 / Q. 10 → Quận 10
 *   - H. <Name> → Huyện <Name>
 *
 * Negative lookbehind `(?<!\p{L})` prevents false-positive matches like
 * `OP3` (where P3 sits inside another word). Numeric prefixes work because
 * `\p{L}` only matches letters.
 */
export function expandAddressAbbreviations(text: string): string {
  return text
    // P3, P.3, P. 3 → Phường 3 (case-insensitive, Unicode-safe boundary)
    .replace(/(?<!\p{L})[Pp]\.?\s*(\d{1,3})\b/gu, (_, digits: string) => `Phường ${parseInt(digits, 10)}`)
    // Q10, Q.10, Q. 10 → Quận 10
    .replace(/(?<!\p{L})[Qq]\.?\s*(\d{1,3})\b/gu, (_, digits: string) => `Quận ${parseInt(digits, 10)}`)
    // H. <Name> → Huyện <Name> (only when followed by uppercase; avoid breaking words like "h."
    // mid-sentence). \p{Lu} = Unicode uppercase letter (catches Đ, Á, etc.).
    .replace(/(?<!\p{L})[Hh]\.\s*(?=\p{Lu})/gu, 'Huyện ');
}

/**
 * Extract province code from a full address. Falls back to HCM when no
 * province pattern is detected — per user direction "không ghi tỉnh →
 * mặc định HCM" because PC02 officers mostly type local HCM addresses
 * without writing the province.
 *
 * Patterns are ordered by specificity. First match wins.
 */
// Unicode-aware word boundary — JS `\b` only knows ASCII so accented Vietnamese
// letters (à, ẵ, ờ ...) silently fail. Use Unicode lookbehind/lookahead instead.
const PROVINCE_PATTERNS: Array<{ regex: RegExp; code: string }> = [
  { regex: /(?<!\p{L})(?:TP\.?\s*)?(?:HCM|H[ồo]\s*Ch[íi]\s*Minh|HoChiMinh|S[àa]i\s*G[òo]n)(?!\p{L})/iu, code: 'HCM' },
  { regex: /(?<!\p{L})(?:TP\.?\s*)?H[àa]\s*N[ộo]i(?!\p{L})/iu, code: 'HN' },
  { regex: /(?<!\p{L})(?:TP\.?\s*)?Đ[àa]\s*N[ẵa]ng(?!\p{L})/iu, code: 'DN' },
  { regex: /(?<!\p{L})(?:TP\.?\s*)?H[ảa]i\s*Ph[òo]ng(?!\p{L})/iu, code: 'HP' },
  { regex: /(?<!\p{L})(?:TP\.?\s*)?C[ầa]n\s*Th[ơo](?!\p{L})/iu, code: 'CT' },
];

export function inferProvince(text: string): string {
  for (const { regex, code } of PROVINCE_PATTERNS) {
    if (regex.test(text)) return code;
  }
  return 'HCM'; // Default fallback per user direction
}

// Regex: phường/xã X, quận/huyện Y
// Matches: "phường 14, quận Phú Nhuận" | "Xã Long Bình, Huyện Nhà Bè" etc.
const OLD_ADDRESS_PATTERN =
  /(?:phường|xã|thị trấn)\s+[^,\n]+?,\s*(?:quận|huyện|thị xã)\s+[^,\n]+/gi;

export function extractComponents(text: string): { ward: string; district: string; matchStart: number; matchEnd: number } | null {
  OLD_ADDRESS_PATTERN.lastIndex = 0;
  const match = OLD_ADDRESS_PATTERN.exec(text);
  if (!match) return null;

  const full = match[0];
  const commaIdx = full.search(/,\s*(?:quận|huyện|thị xã)/i);
  if (commaIdx < 0) return null;

  const ward = full.slice(0, commaIdx).trim();
  const district = full.slice(commaIdx).replace(/^,\s*/, '').trim();

  return { ward, district, matchStart: match.index, matchEnd: match.index + full.length };
}

export interface AddressConversionPreview {
  el: HTMLInputElement | HTMLTextAreaElement;
  original: string;
  converted: string;
  oldFragment: string;
  newFragment: string;
}

export function useAddressConverter() {
  const [preview, setPreview] = useState<AddressConversionPreview | null>(null);

  const handler = useCallback(async (e: KeyboardEvent) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
    if ((el as HTMLInputElement).type === 'password') return;

    const original = el.value;
    if (!original.trim()) return;

    // Phase A: expand abbreviations BEFORE pattern match. Result is the canonical
    // form (P3 → Phường 3) which is also what gets shown back to the user as
    // the converted output — converter doubles as address-cleanup tool.
    const expanded = expandAddressAbbreviations(original);
    const province = inferProvince(expanded);
    const components = extractComponents(expanded);
    if (!components) return; // no old-style address detected even after expansion

    e.preventDefault();

    const { ward, district, matchStart, matchEnd } = components;

    try {
      const res = await api.get('/address-mappings/lookup', {
        params: { ward: ward.toLowerCase(), district: district.toLowerCase(), province },
      });
      const mapping = res.data;

      let newFragment: string;
      if (mapping?.newWard) {
        newFragment = mapping.newWard;
      } else {
        // No mapping found → graceful: drop district, keep ward name.
        newFragment = ward;
      }

      const converted = expanded.slice(0, matchStart) + newFragment + expanded.slice(matchEnd);

      setPreview({
        el,
        original,
        converted,
        oldFragment: expanded.slice(matchStart, matchEnd),
        newFragment,
      });
    } catch {
      const { ward: w, matchStart: s, matchEnd: end } = components;
      const converted = expanded.slice(0, s) + w + expanded.slice(end);
      setPreview({ el, original, converted, oldFragment: expanded.slice(s, end), newFragment: w });
    }
  }, []);

  useShortcut('convertAddress', handler);

  const applyConversion = () => {
    if (!preview) return;
    setNativeValue(preview.el, preview.converted);
    preview.el.setSelectionRange(preview.converted.length, preview.converted.length);
    setPreview(null);
  };

  const cancelConversion = () => setPreview(null);

  return { preview, applyConversion, cancelConversion };
}
