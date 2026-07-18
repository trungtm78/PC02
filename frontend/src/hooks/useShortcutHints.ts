import { useSyncExternalStore } from 'react';

/**
 * Bật/tắt hiển thị gợi ý phím tắt (`<kbd>`) cạnh các nút hành động.
 *
 * Lưu ở `localStorage` (không cần backend) — mặc định BẬT. Đồng bộ đa tab qua
 * `storage` event và cập nhật cùng-tab qua CustomEvent riêng.
 */
const STORAGE_KEY = 'pc02-shortcut-hints';
const CHANGE_EVENT = 'pc02-shortcut-hints-change';

function readEnabled(): boolean {
  try {
    // Mặc định BẬT: chỉ tắt khi giá trị lưu đúng bằng 'false'.
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** Ghi trạng thái bật/tắt + báo cho listener cùng tab. */
export function setShortcutHintsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** True nếu đang bật gợi ý phím tắt cạnh nút (mặc định true). */
export function useShortcutHintsEnabled(): boolean {
  return useSyncExternalStore(subscribe, readEnabled, () => true);
}
