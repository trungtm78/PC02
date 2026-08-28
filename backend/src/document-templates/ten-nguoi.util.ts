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
 * Dạng viết tắt SUY RA từ họ tên — `Trần Hoàng Duy` → `H.Duy`.
 *
 * Dùng cho dòng "Lưu:" của bộ mẫu PC01 (TT 128/2025) — mẫu của CHÍNH hệ mới, nơi quy ước là
 * chữ viết tắt. Bản in theo mẫu HỆ CŨ thì dùng `tenNganNhuHeCu` bên dưới, vì hệ cũ không suy
 * ra mà đọc chuỗi cán bộ tự đặt.
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

/**
 * Chữ đứng ở dòng "Lưu:" của bản in theo mẫu HỆ CŨ.
 *
 * ── Hệ cũ KHÔNG suy ra chữ này ──
 *
 * Mỗi cán bộ tự đặt một chuỗi ở cột `thanh_vien.ten_ngan`, và mã in đổ thẳng chuỗi ấy:
 * `setValue("ten_ngan", $admin_info['ten_ngan'] ?? $nguoi_nhan)`. Ba trạng thái KHÁC nhau —
 * có chuỗi thì in chuỗi, chuỗi RỖNG thì in trống, KHÔNG có cột thì in họ tên đầy đủ.
 *
 * Bản trước dùng `abbrevName`, tức tự suy ra "chữ đệm cuối + tên gọi". Quy tắc ấy đúng với
 * phần lớn tên người nhưng sai hẳn với `Bùi Thanh Trà → Trà`, `Đội 5 → Đ5`,
 * `Tổ Truy Nã → TRUYNA`. Đo 28/08/2026 trên 238 cán bộ: khớp 11, sai 210 — quy ra
 * 16.713/55.207 hồ sơ (30,3%) in sai dòng "Lưu:".
 *
 * Tài khoản tạo mới trên hệ mới chưa có chuỗi ấy, và chúng đi đúng nhánh dự phòng của hệ cũ:
 * in họ tên đầy đủ.
 */
export function tenNganNhuHeCu(u: unknown): string {
  const p = (u ?? {}) as Record<string, unknown>;
  const dat = p['shortName'];
  if (typeof dat === 'string') return dat.trim();
  return personName(u);
}
