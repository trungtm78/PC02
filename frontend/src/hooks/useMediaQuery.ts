import { useSyncExternalStore } from 'react';

/**
 * Điện thoại = khung nhìn ≤767px. Khớp `@media (max-width: 767px)` của `--be-rong-cot-thao-tac` ở `index.css`
 * (lệch nhau thì cột Thao tác rộng 12rem mà chỉ có một nút ⋮, hoặc 5rem mà còn 5 nút).
 */
export const MAN_HINH_DIEN_THOAI = '(max-width: 767px)';

/**
 * MỘT `MediaQueryList` dùng chung cho cả trang, đăng ký đúng một lần.
 *
 * Mỗi dòng danh sách có một `RowActions` — gọi `matchMedia` + `addEventListener` trong từng dòng là 50–100 bộ lắng
 * nghe cho một trang. Ở đây mọi dòng chia nhau một bộ; bộ lắng nghe gốc chỉ gắn khi dòng đầu tiên đăng ký và gỡ khi
 * dòng cuối cùng rời đi.
 */
interface Kho {
  mql: MediaQueryList;
  nguoiNghe: Set<() => void>;
  khiDoi: () => void;
}
const kho = new Map<string, Kho>();

function layKho(truyVan: string): Kho | null {
  const co = kho.get(truyVan);
  if (co) return co;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const mql = window.matchMedia(truyVan);
  const moi: Kho = {
    mql,
    nguoiNghe: new Set(),
    khiDoi: () => moi.nguoiNghe.forEach((f) => f()),
  };
  kho.set(truyVan, moi);
  return moi;
}

function dangKy(truyVan: string, f: () => void): () => void {
  const k = layKho(truyVan);
  if (!k) return () => {};
  if (k.nguoiNghe.size === 0) k.mql.addEventListener('change', k.khiDoi);
  k.nguoiNghe.add(f);
  return () => {
    k.nguoiNghe.delete(f);
    if (k.nguoiNghe.size === 0) {
      k.mql.removeEventListener('change', k.khiDoi);
      kho.delete(truyVan);
    }
  };
}

export function useMediaQuery(truyVan: string): boolean {
  return useSyncExternalStore(
    (f) => dangKy(truyVan, f),
    () => layKho(truyVan)?.mql.matches ?? false,
    () => false,
  );
}

export function useDienThoai(): boolean {
  return useMediaQuery(MAN_HINH_DIEN_THOAI);
}

/** Chỉ cho ca kiểm: số bộ lắng nghe gốc đang gắn. */
export function soKhoMediaQueryChoCaKiem(): number {
  return kho.size;
}
