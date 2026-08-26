/**
 * Phân loại một ô của ma trận field-parity: (field hệ cũ × thực thể) → đích ở hệ mới.
 *
 * Tách khỏi `build-field-parity.ts` vì phần này quyết định "có sót dữ liệu không" và phải
 * kiểm chứng được mà không cần một máy chủ cơ sở dữ liệu.
 *
 * HAI CHỖ BỘ SINH CŨ SUY SAI, đo lại trên 46.499 đơn thư ngày 26/08/2026:
 *
 *  1. `truong_hop_bao_cao_ban_giam_doc` báo "OK (baoCaoBanGiamDoc)". Cột ấy là ĐÚNG/SAI, còn
 *     hệ cũ khai kiểu `text` và 35.261 hồ sơ có CHỮ. Bộ sinh chỉ hỏi "cột có tồn tại không",
 *     chưa bao giờ hỏi "cột có CHỨA NỔI không" — một cột một bit nhận nội dung chỉ đạo của
 *     Ban Giám đốc thì phần chữ bốc hơi mà bảng vẫn ghi OK.
 *
 *  2. `tinh_trang` báo "RESOLVE" cho cả ba thực thể, nhưng bảng `petitions` khi ấy không có
 *     cột nào nhận, và 15.039 hồ sơ nằm kẹt ở `legacyRaw`. RESOLVE là một LỜI KHAI ("field
 *     này cần biến đổi đặc biệt"), bộ sinh cũ nhận lời khai ấy cho MỌI thực thể mà không hỏi
 *     thực thể đó có ai đọc field không.
 *
 * Hai sửa đổi tương ứng, cả hai đều là "đòi bằng chứng" chứ không phải vá riêng hai khoá:
 *
 *  - Đích phải CHỨA NỔI kiểu của field, không chỉ tồn tại.
 *  - Lời khai RESOLVE chỉ có hiệu lực ở thực thể mà builder THẬT SỰ đọc field.
 */

export type Entity = 'petition' | 'incident' | 'case';
export type Status =
  | 'RESOLVE'
  | 'OK'
  | 'FIX_BUILDER'
  | 'METADATA_ONLY'
  | 'NEEDS_COLUMN'
  | 'MAT_KIEU'
  | 'DROP';

/** Một chỗ mà builder đổ field vào: tên cột, hoặc `metadata.<khoá>`. */
export interface Target {
  column: string;
  inMetadata: boolean;
}

/**
 * Kiểu hệ cũ mà mỗi kiểu cột Prisma chứa được nguyên vẹn.
 *
 * Chỉ khai chỗ HẸP: không có tên trong bảng này thì cột chứa được tất.
 *
 * Vì sao chỉ có `Boolean`. Hệ cũ khai KIỂU CỦA Ô NHẬP, không phải kiểu lưu — đo trên bảng
 * định nghĩa trường ngày 26/08/2026: `ngay_viet_don`, `ngay_tiep_nhan_nguon_tin`,
 * `ngay_phieu_chuyen`… đều khai `text` dù chứa mốc thời gian. Nếu coi `text → DateTime` là
 * mất kiểu thì gần như MỌI cột ngày và cột số của hệ thống bị báo động, và một cổng kiểm
 * kêu oan là một cổng kiểm sắp bị tắt.
 *
 * `text → DateTime` và `text → Int` là PHÉP ĐỌC: cùng một giá trị, đổi cách biểu diễn.
 * `text → Boolean` là PHÉP XÉT: `boolFromText` cố ý vứt nội dung, giữ lại một bit. Đó là
 * chỗ duy nhất có bằng chứng mất dữ liệu — 35.261 hồ sơ có chữ chỉ đạo của Ban Giám đốc.
 */
const CHUA_DUOC: Readonly<Record<string, ReadonlySet<string>>> = {
  Boolean: new Set(['checkbox', 'bool', 'boolean']),
};

/**
 * Cột có chứa nổi field không?
 *
 * Kiểu hệ cũ KHÔNG BIẾT (field lõi, không nằm trong bảng định nghĩa trường tuỳ chỉnh) →
 * trả `true`. Không có bằng chứng lệch thì không được kết luận là lệch: bộ sinh này gác
 * "sót dữ liệu", báo động giả hàng loạt sẽ làm người ta tắt nó đi.
 */
export function cotChuaNoi(kieuCot: string, kieuHeCu: string): boolean {
  const k = (kieuHeCu || '').trim().toLowerCase();
  if (!k) return true;
  const hep = CHUA_DUOC[kieuCot];
  return hep ? hep.has(k) : true;
}

export interface DauVaoPhanLoai {
  field: string;
  /** Mọi chỗ builder của thực thể ấy đổ field vào, theo thứ tự gặp trong mã. */
  targets: readonly Target[];
  /** Cột thật của thực thể → kiểu Prisma. */
  cotThat: ReadonlyMap<string, string>;
  /** Cột khai tay trong `field-mapping.seed.ts`, nếu có. */
  mapCol: string | null;
  /** Field có lời khai RESOLVE không. */
  laResolve: boolean;
  /** Kiểu hệ cũ khai ở bảng định nghĩa trường (rỗng nếu không biết). */
  kieuHeCu: string;
}

export interface KetQuaPhanLoai {
  status: Status;
  column: string | null;
}

export function phanLoaiO(v: DauVaoPhanLoai): KetQuaPhanLoai {
  const cotThuc = v.targets.filter((t) => !t.inMetadata && v.cotThat.has(t.column));
  const vua = cotThuc.find((t) => cotChuaNoi(v.cotThat.get(t.column) as string, v.kieuHeCu));

  // Lời khai RESOLVE chỉ có giá trị ở thực thể mà builder thật sự CHUYỂN field đi đâu đó.
  //
  // Phân biệt KHOÁ TRUNG GIAN với CHỖ TRÚ TẠM. `crimeChinhLegacyValue` không phải cột nào cả —
  // nó là khoá bộ nạp nhận rồi phân giải thành `crimeChinhId`, và số đo xác nhận: 14.594 đơn
  // thư có `crimeChinhId` so với 14.511 đơn có mã tội danh cũ. Đó là phân giải thật.
  //
  // `metadata.*` thì ngược lại — không ai phân giải gì, giá trị nằm đó chờ. Tính nó là "đã
  // phân giải" thì ô rơi khỏi danh sách cần cột và không ai bù nữa: `case/tinh_trang` đúng
  // cảnh ấy, builder chỉ đặt `metadata.tinhTrang` trong khi bảng `cases` có sẵn cột bỏ trống.
  const khongPhaiMeta = v.targets.filter((t) => !t.inMetadata);
  if (v.laResolve && khongPhaiMeta.length > 0) {
    return { status: 'RESOLVE', column: vua ? vua.column : null };
  }

  if (vua) return { status: 'OK', column: vua.column };

  // Có cột nhận, nhưng không cột nào chứa nổi kiểu của field → phần không vừa bị mất.
  if (cotThuc.length > 0) return { status: 'MAT_KIEU', column: cotThuc[0].column };

  const meta = v.targets.find((t) => t.inMetadata);
  if (meta) return { status: 'METADATA_ONLY', column: meta.column };

  if (v.mapCol && v.cotThat.has(v.mapCol)) return { status: 'FIX_BUILDER', column: v.mapCol };

  return { status: 'NEEDS_COLUMN', column: v.mapCol };
}

/** Ô nào tính là "phải thêm cột" — cổng kiểm `field-parity.gate.spec.ts` đọc danh sách này. */
export const STATUS_CAN_COT: ReadonlySet<Status> = new Set<Status>([
  'METADATA_ONLY',
  'NEEDS_COLUMN',
  'MAT_KIEU',
]);
