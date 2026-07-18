import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { SHORTCUTS, serializeKey } from '@/shortcuts/registry';
import { useUserShortcutMap } from './useUserShortcuts';

/**
 * Điều hướng ô lỗi trong form nhập liệu:
 * - `focusFirstError()`: focus ô lỗi ĐẦU khi lưu chưa hợp lệ (thay vì chỉ cuộn lên đầu).
 * - `handleFormKeyDown`: gắn vào `<form onKeyDown>`, phím "Lỗi tiếp theo"
 *   (mặc định Shift+Enter, đổi được ở Settings) nhảy tới ô lỗi KẾ (xoay vòng).
 *
 * @param getErrorFields Trả về danh sách `data-testid` các ô ĐANG lỗi theo THỨ TỰ
 *   hiển thị (trên → dưới). Tính lại mỗi lần gọi để luôn khớp trạng thái form.
 */
export function useFormErrorNavigation(getErrorFields: () => string[]) {
  const map = useUserShortcutMap();
  const nextErrorBinding = map.get('nextError') ?? SHORTCUTS.nextError.defaultBinding;

  /** Focus 1 field theo data-testid (input/select/textarea hoặc trigger của FKSelect/CrimeSelect). */
  const focusField = useCallback((testid: string) => {
    const root = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
    let target: HTMLElement | null = null;
    if (root) {
      target = root.matches('input,select,textarea')
        ? root
        : root.querySelector<HTMLElement>('input,select,textarea');
    }
    if (!target) target = document.querySelector<HTMLElement>(`[data-testid="${testid}-trigger"]`);
    if (!target) target = root;
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (target.tabIndex < 0 && !target.matches('input,select,textarea,button,a')) target.tabIndex = -1;
    window.setTimeout(() => target?.focus?.(), 60);
  }, []);

  /** Focus ô lỗi đầu tiên. Trả về true nếu có lỗi (đã focus), false nếu không. */
  const focusFirstError = useCallback((): boolean => {
    const first = getErrorFields()[0];
    if (first) {
      focusField(first);
      return true;
    }
    return false;
  }, [getErrorFields, focusField]);

  /** Gắn vào `<form>`/`<div>` `onKeyDown`. Phím "Lỗi tiếp theo" → nhảy ô lỗi kế (xoay vòng); hết lỗi thì để mặc định. */
  const handleFormKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (serializeKey(e.nativeEvent) !== nextErrorBinding) return;
      const fields = getErrorFields();
      if (fields.length === 0) return;
      e.preventDefault();
      const activeTestid =
        (document.activeElement as HTMLElement | null)
          ?.closest('[data-testid]')
          ?.getAttribute('data-testid') || '';
      const baseTestid = activeTestid.replace(/-(trigger|search|dropdown|option-.*)$/, '');
      const idx = fields.indexOf(baseTestid);
      focusField(fields[(idx + 1) % fields.length]);
    },
    [nextErrorBinding, getErrorFields, focusField],
  );

  return { focusField, focusFirstError, handleFormKeyDown };
}
