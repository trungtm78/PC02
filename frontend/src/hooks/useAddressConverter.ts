import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Reuse same setNativeValue pattern as useAbbreviationExpander (F9)
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// Regex: phường/xã X, quận/huyện Y
// Matches: "phường 14, quận Phú Nhuận" | "Xã Long Bình, Huyện Nhà Bè" etc.
const OLD_ADDRESS_PATTERN =
  /(?:phường|xã|thị trấn)\s+[^,\n]+?,\s*(?:quận|huyện|thị xã)\s+[^,\n]+/gi;

function extractComponents(text: string): { ward: string; district: string; matchStart: number; matchEnd: number } | null {
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

export function useAddressConverter(hotkey = 'F10') {
  const [preview, setPreview] = useState<AddressConversionPreview | null>(null);

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== hotkey) return;

      const el = document.activeElement;
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if ((el as HTMLInputElement).type === 'password') return;

      const text = el.value;
      if (!text.trim()) return;

      const components = extractComponents(text);
      if (!components) return; // no old-style address detected

      e.preventDefault();

      const { ward, district, matchStart, matchEnd } = components;

      try {
        // Look up in DB (province defaults to HCM for now)
        const res = await api.get('/address-mappings/lookup', {
          params: { ward: ward.toLowerCase(), district: district.toLowerCase(), province: 'HCM' },
        });
        const mapping = res.data;

        let newFragment: string;
        if (mapping?.newWard) {
          // Found mapping → use new ward name
          newFragment = mapping.newWard;
        } else {
          // No mapping → just remove district part, keep ward name
          newFragment = ward;
        }

        const converted = text.slice(0, matchStart) + newFragment + text.slice(matchEnd);

        setPreview({
          el,
          original: text,
          converted,
          oldFragment: text.slice(matchStart, matchEnd),
          newFragment,
        });
      } catch {
        // API error — graceful fallback: remove district only
        const { ward: w, matchStart: s, matchEnd: end } = components;
        const converted = text.slice(0, s) + w + text.slice(end);
        setPreview({ el, original: text, converted, oldFragment: text.slice(s, end), newFragment: w });
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hotkey]);

  const applyConversion = () => {
    if (!preview) return;
    setNativeValue(preview.el, preview.converted);
    preview.el.setSelectionRange(preview.converted.length, preview.converted.length);
    setPreview(null);
  };

  const cancelConversion = () => setPreview(null);

  return { preview, applyConversion, cancelConversion };
}
