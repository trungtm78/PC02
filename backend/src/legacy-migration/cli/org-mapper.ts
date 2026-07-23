/**
 * Ánh xạ tổ chức hệ cũ → Tổ/Nhóm + Người dùng hệ mới. Hàm THUẦN, test được.
 *
 * Vì sao cần chuẩn hoá tên: cùng một đơn vị nhưng hai hệ viết khác nhau —
 * `Đội 3` (cũ) vs `Đội 3 (TT)` (mới), `Tổ Công tác Số 1` vs `Tổ CT số 1`,
 * `Công an Phường Bàn Cờ` vs `Phường Bàn Cờ`. Khớp thô sẽ tạo trùng lặp, mà
 * `Team.name` VÀ `Team.code` đều `@unique` nên tạo trùng là ném lỗi giữa chừng.
 */

/** Bỏ dấu tiếng Việt, gộp khoảng trắng, đưa về chữ thường. */
export function normalizeVi(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Khoá so khớp tên đơn vị giữa hai hệ. Rút về dạng ngắn nhất còn phân biệt được:
 *   "Đội 3" / "Đội 3 (TT)" / "BCH Đội 3"        → "doi 3"
 *   "Tổ Công tác Số 1" / "Tổ CT số 1"           → "to ct 1"
 *   "Công an Phường Bàn Cờ" / "Phường Bàn Cờ"   → "ban co"
 *   "Công an quận Bình Thạnh" / "Bình Thạnh"    → "binh thanh"
 */
export function teamMatchKey(name: string): string {
  let s = normalizeVi(name);
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // bỏ phần trong ngoặc: "(TT)"
  s = s.replace(/^bch\s+/, ''); // "BCH Đội 4" → "Đội 4"
  s = s.replace(/^cong an\s+/, ''); // "Công an Phường X" → "Phường X"
  s = s.replace(/^to cong tac so\s+/, 'to ct '); // đồng nhất hai cách viết Tổ công tác
  s = s.replace(/^to ct so\s+/, 'to ct ');
  s = s.replace(/^(phuong|xa|quan|huyen)\s+/, ''); // bỏ tiền tố cấp hành chính
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Khoá khớp ĐẦY ĐỦ = cấp + tên rút gọn.
 *
 * Chỉ dùng tên là gộp nhầm: hệ cũ có CẢ quận `Bình Tân` (cấp huyện, đã bãi bỏ) LẪN
 * `Công an Phường Bình Tân` (cấp xã hiện hành) — hai đơn vị khác nhau, cùng rút gọn
 * thành "binh tan". Đo trên dữ liệu thật: 14 đơn vị bị nuốt mất khi bỏ qua cấp
 * (Bình Tân, Bình Chánh, Củ Chi, Hóc Môn, Nhà Bè, Cần Giờ, Thủ Đức, Gò Vấp,
 * Phú Nhuận, Tân Phú, Bình Thạnh, Tân Bình…), kéo theo hồ sơ hai đơn vị dồn về một tổ.
 */
export function teamScopedKey(level: number, name: string): string {
  return `${level}|${teamMatchKey(name)}`;
}

export type LegacyUnitKind = 'ROOT' | 'CO_SO' | 'DOI' | 'TO_CONG_TAC' | 'QUAN_HUYEN' | 'PHUONG_XA' | 'KHAC';

/**
 * `chi_nhanh.loai_don_vi` là trường phân loại có sẵn của hệ cũ. Phân bố đo trên
 * toàn bộ 208 đơn vị: 1→PC02 (1) · 2→Cơ sở (2) · 6→Đội/Truy nã (5) ·
 * 7→Tổ công tác (10) · 5→quận/huyện cũ (22) · 3→phường/xã (168).
 */
export function unitKindOf(loaiDonVi: unknown): LegacyUnitKind {
  switch (String(loaiDonVi ?? '').trim()) {
    case '1': return 'ROOT';
    case '2': return 'CO_SO';
    case '6': return 'DOI';
    case '7': return 'TO_CONG_TAC';
    case '5': return 'QUAN_HUYEN';
    case '3': return 'PHUONG_XA';
    default: return 'KHAC';
  }
}

/** Phường/xã là cấp 2; mọi đơn vị còn lại là cấp 1, riêng PC02 là gốc (cấp 0). */
export function teamLevelOf(kind: LegacyUnitKind): number {
  if (kind === 'ROOT') return 0;
  if (kind === 'PHUONG_XA') return 2;
  return 1;
}

/**
 * Quận/huyện đã bị bãi bỏ từ 01/7/2025 (mô hình chính quyền 2 cấp) nhưng hồ sơ
 * 2016-2025 vẫn trỏ về, nên vẫn tạo — chỉ đánh dấu ngừng hoạt động.
 */
export function teamIsActive(kind: LegacyUnitKind): boolean {
  return kind !== 'QUAN_HUYEN';
}

/** Sinh mã tổ từ tên rút gọn hệ cũ; giữ chữ và số, cắt còn 20 ký tự. */
export function teamCodeOf(tenNgan: string | undefined, ten: string): string {
  const base = normalizeVi(tenNgan?.trim() || ten)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'TO').slice(0, 20);
}

/** Thêm hậu tố -2, -3… cho tới khi mã chưa bị dùng (`Team.code` là @unique). */
export function uniqueCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const c = `${base.slice(0, 17)}-${i}`;
    if (!taken.has(c)) return c;
  }
  throw new Error(`Không sinh được mã tổ duy nhất từ "${base}"`);
}

// ── Người dùng ──────────────────────────────────────────────────────────────

/**
 * Vai trò hệ cũ (`thanh_vien.phan_quyen`, dạng ",<id>,") → vai trò hệ mới.
 * Phân bố đo trên 237 tài khoản: ",12," Cán bộ 205 · ",11," cán bộ tham mưu đội 22 ·
 * ",5," Quản lý tham mưu 7 · ",," (gồm tài khoản admin) 3.
 *
 * Hệ mới chỉ có ADMIN / OFFICER / DEADLINE_APPROVER, nên hai nhóm tham mưu ánh xạ
 * thành OFFICER kèm `canDispatch` (đọc toàn bộ + phân công) thay vì bịa vai trò mới.
 */
export interface MappedRole {
  roleName: 'ADMIN' | 'OFFICER';
  canDispatch: boolean;
}

export function roleOf(phanQuyen: unknown): MappedRole {
  const ids = String(phanQuyen ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (ids.length === 0) return { roleName: 'ADMIN', canDispatch: true };
  if (ids.includes('5') || ids.includes('11')) return { roleName: 'OFFICER', canDispatch: true };
  return { roleName: 'OFFICER', canDispatch: false };
}

/**
 * Tên đăng nhập. Trường `email` của hệ cũ KHÔNG phải email — đo trên 237 tài khoản
 * chỉ 1 giá trị có ký tự `@`; còn lại là tên đăng nhập thuần (`huyblue`, `A4`,
 * `Đội 8`). Cả `email`, `so_dt`, `ten` đều 100% duy nhất nên dùng thẳng được.
 */
export function usernameOf(rec: Record<string, unknown>): string | undefined {
  for (const key of ['email', 'so_dt', 'ten']) {
    const v = rec[key];
    const s = v === null || v === undefined ? '' : String(v).trim();
    if (s) return s;
  }
  return undefined;
}

/** Chỉ nhận email THẬT; phần còn lại để NULL (`User.email` là nullable + unique). */
export function realEmailOf(rec: Record<string, unknown>): string | undefined {
  const v = String(rec.email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : undefined;
}

/** Tách họ và tên: phần cuối là tên, phần trước là họ + đệm. */
export function splitFullName(full: string): { firstName: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: full.trim() || 'Không rõ' };
  return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
}
