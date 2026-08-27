/**
 * Chọn hồ sơ cần cập nhật từ hệ cũ — hàm thuần, tách khỏi mọi kết nối.
 *
 * Cập nhật LẠI toàn bộ là hỏng: hồ sơ đã di trú mà cán bộ đã chỉnh trên hệ mới sẽ bị dữ liệu
 * hệ cũ ghi đè, mất thứ họ vừa sửa mà không một thông báo nào. Nên chỉ đụng đúng hai nhóm:
 *
 *   • hồ sơ hệ mới CHƯA CÓ (theo khoá `ho_so_doi_1:<id>`);
 *   • hồ sơ hệ cũ đã sửa SAU lần di trú gần nhất (`_update_time` mới hơn bản đã lưu).
 *
 * Hồ sơ hệ cũ đánh dấu `da_xoa` thì bỏ qua — hệ cũ xoá mềm, và ta không xoá gì ở hệ mới theo
 * dấu ấy: hồ sơ đã vào hệ mới có thể đang được xử lý ở đây.
 */

/** Tài liệu hệ cũ, chỉ phần cần để quyết định. */
export interface TaiLieuHeCu {
  id?: unknown;
  da_xoa?: unknown;
  _update_time?: unknown;
}

export type LyDo = 'chua-co' | 'da-sua';

export interface CanCapNhat {
  /** Khoá di trú: `ho_so_doi_1:<id>`. */
  khoa: string;
  /** `id` số của hệ cũ, dạng chuỗi — đúng thứ `legacy_staging.sourceId` lưu. */
  sourceId: string;
  lyDo: LyDo;
}

export interface KetQuaChon {
  canCapNhat: CanCapNhat[];
  chuaCo: number;
  daSua: number;
  khongDoi: number;
  boQuaVìĐãXoá: number;
  boQuaVìThiếuId: number;
}

/** Khoá di trú của một tài liệu hệ cũ. */
export function khoaCuaTaiLieu(bang: string, id: unknown): string {
  return `${bang}:${String(id)}`;
}

function soThoiGian(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param heCu       tài liệu đọc từ hệ cũ
 * @param mocDaCo    khoá di trú → `_update_time` của bản đã nằm trong hệ mới
 * @param bang       tên bảng nguồn, mặc định `ho_so_doi_1`
 */
export function chonHoSoCanCapNhat(
  heCu: readonly TaiLieuHeCu[],
  mocDaCo: ReadonlyMap<string, number>,
  bang = 'ho_so_doi_1',
): KetQuaChon {
  const kq: KetQuaChon = {
    canCapNhat: [],
    chuaCo: 0,
    daSua: 0,
    khongDoi: 0,
    boQuaVìĐãXoá: 0,
    boQuaVìThiếuId: 0,
  };
  for (const d of heCu) {
    if (d.id === null || d.id === undefined || String(d.id).trim() === '') {
      kq.boQuaVìThiếuId++;
      continue;
    }
    if (d.da_xoa === true) {
      kq.boQuaVìĐãXoá++;
      continue;
    }
    const khoa = khoaCuaTaiLieu(bang, d.id);
    const sourceId = String(d.id);
    if (!mocDaCo.has(khoa)) {
      kq.chuaCo++;
      kq.canCapNhat.push({ khoa, sourceId, lyDo: 'chua-co' });
      continue;
    }
    if (soThoiGian(d._update_time) > (mocDaCo.get(khoa) ?? 0)) {
      kq.daSua++;
      kq.canCapNhat.push({ khoa, sourceId, lyDo: 'da-sua' });
      continue;
    }
    kq.khongDoi++;
  }
  return kq;
}
