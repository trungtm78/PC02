import { useCallback } from 'react';
import { useAbbreviationMap } from './useAbbreviations';
import { useShortcut } from './useShortcut';

function getLastWordRange(el: HTMLInputElement | HTMLTextAreaElement): {
  word: string;
  start: number;
  end: number;
} {
  const cursor = el.selectionStart ?? el.value.length;
  const text = el.value;

  // Walk backward from cursor to find start of last "word" (no whitespace)
  let start = cursor;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--;
  }

  return { word: text.slice(start, cursor), start, end: cursor };
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // FINDING-1: use the correct prototype for input vs textarea
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function useAbbreviationExpander() {
  const abbrevMap = useAbbreviationMap();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if ((el as HTMLInputElement).type === 'password') return;

      const { word, start, end } = getLastWordRange(el);
      if (!word) return;

      const expansion = abbrevMap.get(word);
      if (!expansion) return;

      e.preventDefault();

      const newValue = el.value.slice(0, start) + expansion + el.value.slice(end);
      setNativeValue(el, newValue);
      el.setSelectionRange(start + expansion.length, start + expansion.length);
    },
    [abbrevMap],
  );

  useShortcut('expandAbbreviation', handler);
}
