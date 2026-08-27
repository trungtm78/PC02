/**
 * Chọn tội danh master cho một hồ sơ di trú.
 *
 * Hệ cũ ghi tội danh chính bằng SỐ (`toi_danh_chinh_blhs2015` / `toi_danh_chinh` =
 * `Crime.legacyValue`). Vài hồ sơ chỉ còn TÊN ở cột chữ của hệ mới, nên có đường lùi khớp tên.
 *
 * Tách khỏi CLI để kiểm chứng được mà không cần cơ sở dữ liệu — và để cả Vụ án lẫn Vụ việc
 * dùng chung một cách chọn, thay vì mỗi bên một bản chép.
 */

/** Chuẩn hoá tên tội danh để khớp: bỏ dấu, thường hoá, gộp khoảng trắng, bỏ tiền tố "tội". */
export function chuanTenToi(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    // Gộp khoảng trắng và cắt hai đầu TRƯỚC khi bỏ tiền tố: tên có khoảng trắng đứng đầu thì
    // neo `^tội` không khớp, và cái tên ấy im lặng không nối được với bảng master.
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^tội\s+|^toi\s+/, '');
}

export interface BangTraToiDanh {
  /** `Crime.legacyValue` → id. */
  theoSo: ReadonlyMap<number, string>;
  /** Tên đã chuẩn hoá → id. */
  theoTen: ReadonlyMap<string, string>;
}

export type CachChon = 'so' | 'ten' | 'khong';

export interface KetQuaChon {
  crimeId?: string;
  cach: CachChon;
}

/**
 * @param banGoc  bản thô hệ cũ của hồ sơ (`legacyRaw`, hoặc bản của thực thể anh em).
 * @param tenCu   tên tội danh dạng chữ đang có trên hồ sơ, nếu thực thể ấy có cột chữ.
 */
export function chonToiDanh(
  banGoc: Record<string, unknown> | null | undefined,
  tenCu: string | null | undefined,
  bang: BangTraToiDanh,
): KetQuaChon {
  const raw = banGoc ?? {};
  const lvRaw = raw.toi_danh_chinh_blhs2015 ?? raw.toi_danh_chinh;
  const lv = Number(String(lvRaw ?? '').trim());
  if (Number.isInteger(lv) && lv > 0) {
    const id = bang.theoSo.get(lv);
    if (id) return { crimeId: id, cach: 'so' };
  }
  if (tenCu) {
    const id = bang.theoTen.get(chuanTenToi(tenCu));
    if (id) return { crimeId: id, cach: 'ten' };
  }
  return { cach: 'khong' };
}
