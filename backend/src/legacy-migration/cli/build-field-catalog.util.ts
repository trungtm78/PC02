/**
 * Helper thuần cho build-field-catalog: chuẩn hoá `TruongTuyChinh` + `NgonNgu`
 * (đã export EJSON) thành catalog field. KHÔNG I/O — dễ test.
 */

export interface CatalogField {
  tenTruong: string;
  tenHienThi: string;
  kieuDuLieu: string;
  batBuoc: boolean;
  loai: string; // ho_so | bi_can | dieu_tra_bo_sung
  options: Array<{ giaTri: string; tenHienThi: string }>;
  hienThiForm: boolean;
  donViArr: number[];
  id: number | null;
}

/** Chuẩn hoá 1 doc TruongTuyChinh (đã parse EJSON) → CatalogField. */
export function parseTruongField(doc: Record<string, any>): CatalogField {
  return {
    tenTruong: String(doc.ten_truong ?? '').trim(),
    tenHienThi: String(doc.ten_hien_thi ?? '').trim(),
    kieuDuLieu: String(doc.kieu_du_lieu ?? 'text').trim(),
    batBuoc: doc.bat_buoc === true,
    loai: String(doc.loai ?? '').trim(),
    options: normalizeOptions(doc.danh_sach_lua_chon),
    hienThiForm: doc.hien_thi_trong_form === true,
    donViArr: Array.isArray(doc.don_vi_arr) ? doc.don_vi_arr.map((x: any) => Number(x)).filter((x: number) => !Number.isNaN(x)) : [],
    id: doc.id != null ? Number(doc.id) : null,
  };
}

/** `danh_sach_lua_chon` có thể là "" hoặc mảng [{gia_tri, ten_hien_thi}] → chuẩn hoá. */
export function normalizeOptions(raw: any): Array<{ giaTri: string; tenHienThi: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => ({
      giaTri: String(o?.gia_tri ?? o?.value ?? '').trim(),
      tenHienThi: String(o?.ten_hien_thi ?? o?.label ?? '').trim(),
    }))
    .filter((o) => o.giaTri !== '' || o.tenHienThi !== '');
}

/** 1 doc NgonNgu → { ten, values: {code: nhãn vn} }. Lấy `val.vn`. */
export function parseNgonNguEnum(doc: Record<string, any>): { ten: string; values: Record<string, string> } {
  const vn = doc?.val?.vn;
  const values: Record<string, string> = {};
  if (vn && typeof vn === 'object') {
    for (const [k, v] of Object.entries(vn)) values[k] = String(v);
  }
  return { ten: String(doc.ten ?? '').trim(), values };
}

/**
 * Gộp danh sách CatalogField theo (loai, tenTruong): cùng field khai ở nhiều đơn vị →
 * hợp nhất, union đơn vị, cảnh báo nếu NHÃN/KIỂU khác nhau giữa các đơn vị (định nghĩa xung đột).
 */
export interface MergedField extends CatalogField {
  conflicts: string[];
}

export function mergeByFieldName(fields: CatalogField[]): MergedField[] {
  const map = new Map<string, MergedField>();
  for (const f of fields) {
    if (!f.tenTruong) continue;
    const key = `${f.loai}::${f.tenTruong}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...f, donViArr: [...f.donViArr], conflicts: [] });
      continue;
    }
    // union đơn vị
    existing.donViArr = [...new Set([...existing.donViArr, ...f.donViArr])];
    if (existing.tenHienThi !== f.tenHienThi && f.tenHienThi) {
      existing.conflicts.push(`nhãn khác: "${existing.tenHienThi}" vs "${f.tenHienThi}"`);
    }
    if (existing.kieuDuLieu !== f.kieuDuLieu) {
      existing.conflicts.push(`kiểu khác: ${existing.kieuDuLieu} vs ${f.kieuDuLieu}`);
    }
    if (f.batBuoc) existing.batBuoc = true;
    if (f.options.length && !existing.options.length) existing.options = f.options;
  }
  return [...map.values()];
}
