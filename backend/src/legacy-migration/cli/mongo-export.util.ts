import { EJSON } from 'bson';

/**
 * Serialize 1 Mongo document thành MỘT dòng Extended JSON canonical.
 * Canonical (relaxed:false) bảo toàn kiểu BSON: ObjectId→$oid, Date→$date,
 * Long→$numberLong, Decimal128→$numberDecimal. JSONL thô (JSON.stringify) sẽ
 * làm rớt các kiểu này → import sai. Dùng cho export legacy Mongo.
 */
export function toEjsonLine(doc: unknown): string {
  return EJSON.stringify(doc, { relaxed: false });
}

/** Parse ngược 1 dòng EJSON canonical → object có kiểu BSON đúng. */
export function parseEjsonLine(line: string): unknown {
  return EJSON.parse(line, { relaxed: false });
}

export interface SnapshotCounts {
  countStart: number;
  countEnd: number;
  written: number;
}

/**
 * Kiểm nhất quán snapshot 1 collection: count trước == count sau == số doc ghi ra.
 * Lệch count đầu/cuối = dữ liệu đổi khi đang export (không phải snapshot nhất quán).
 * Lệch written = mất doc khi stream (cursor timeout / lỗi).
 */
export function reconcileSnapshot({ countStart, countEnd, written }: SnapshotCounts): {
  ok: boolean;
  reason?: string;
} {
  if (countStart !== countEnd) {
    return { ok: false, reason: `Count đầu (${countStart}) khác count cuối (${countEnd}) — dữ liệu đổi khi export` };
  }
  if (written !== countStart) {
    return { ok: false, reason: `Số doc ghi ra (${written}) khác count (${countStart}) — thiếu doc khi stream` };
  }
  return { ok: true };
}

/**
 * Collection nghiệp vụ án cần export từ Mongo live (db `pc02`).
 * KHÔNG lấy nhóm kho/POS/log (nhiễu). TamDinhChi_vu_viec_* resolve động lúc chạy.
 */
export const LEGACY_COLLECTIONS: string[] = [
  // Hồ sơ + con
  'ho_so',
  'ho_so_doi_1',
  'bi_can',
  'bi_can_doi_1',
  'dieu_tra_bo_sung',
  'dieu_tra_bo_sung_doi_1',
  // Danh mục / metadata điều khiển field động
  'TruongTuyChinh',
  'NgonNgu',
  'ToiDanh',
  'NghiepVu',
  'NghiepVuBiCan',
  'chi_nhanh',
  'thanh_vien',
  'max_id',
];
