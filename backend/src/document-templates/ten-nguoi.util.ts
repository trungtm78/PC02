/**
 * Cách viết họ tên cán bộ trên chứng từ.
 *
 * Tách khỏi `field-catalog.ts` vì hai tệp cùng cần: catalog dựng khoá theo tên hệ mới, còn
 * `khoa-he-cu.ts` dựng khoá theo tên trường hệ cũ. Để nguyên trong catalog thì hai tệp nhập
 * lẫn nhau — và vòng nhập ấy làm `CO_SAN_THEO_THUC_THE` chưa kịp khởi tạo lúc catalog dựng
 * bảng, ném ngay khi nạp mô-đun.
 */

/**
 * Họ tên đầy đủ — HỌ TRƯỚC, TÊN SAU. Bản ghi người dùng lưu theo quy ước tiếng Anh:
 * `lastName` là họ và tên đệm, `firstName` là tên gọi.
 */
export function personName(u: unknown): string {
  const p = (u ?? {}) as Record<string, unknown>;
  return [p['lastName'], p['firstName']].filter(Boolean).join(' ').trim();
}

/** Họ tên kèm cấp bậc — dùng cho dòng ký của cán bộ. */
export function rankName(u: unknown): string {
  const p = (u ?? {}) as Record<string, unknown>;
  return [p['rank'], personName(u)].filter(Boolean).join(' ').trim();
}

/**
 * Dạng viết tắt cho dòng "Lưu:" cuối văn bản — `Trần Hoàng Duy` → `H.Duy`.
 *
 * Đúng cách hệ cũ in: lấy chữ cuối của tên đệm làm chữ cái đầu, rồi tên gọi.
 */
export function abbrevName(u: unknown): string {
  const full = personName(u);
  if (!full) return '';
  const parts = full.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length < 2) return last;
  const middle = parts[parts.length - 2];
  return `${middle.charAt(0).toUpperCase()}.${last}`;
}
