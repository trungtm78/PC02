/**
 * Phân loại giá trị `don_vi_giai_quyet` của hệ cũ. Hàm THUẦN, test được.
 *
 * Vì sao cần: đo trên 100% 53.820 hồ sơ, trường này chỉ khớp tên đơn vị 28,82%.
 * Nguyên nhân KHÔNG phải lỗi chuẩn hoá mà là trường này chứa lẫn BA thứ khác nhau:
 *   1. tổ nội bộ            — "Đội 8" (12.857 hồ sơ), "BCH Đội 8" (945)
 *   2. cơ quan ngoài        — "Phòng PC01 Công an TP Hồ Chí Minh" (601)
 *   3. KẾT QUẢ xử lý        — "Trả đơn, hướng dẫn khởi kiện tại TAND" (274)
 * Gán bừa cả ba vào cột đơn vị là bịa dữ liệu, nên phải tách rõ trước khi nạp.
 */
import { normalizeVi, teamMatchKey } from './org-mapper';

export type AliasKind = 'TEAM' | 'EXTERNAL_ORG' | 'RESULT' | 'UNKNOWN';

/** Cụm từ cho thấy giá trị là KẾT QUẢ xử lý chứ không phải tên đơn vị. */
const RESULT_MARKERS = [
  'tra don',
  'huong dan',
  'khoi kien',
  'bo sung tai lieu',
  'khong thu ly',
  'khong khoi to',
  'chuyen don',
  'luu don',
  'giai quyet xong',
  'da giai quyet',
];

/** Cụm từ cho thấy đây là cơ quan NGOÀI cơ cấu PC02. */
const EXTERNAL_MARKERS = [
  'pc01',
  'pc03',
  'pc04',
  'pa',
  'vien kiem sat',
  'vks',
  'toa an',
  'tand',
  'cuc ',
  'bo cong an',
  'cong an tp',
  'cong an thanh pho',
  'cong an tinh',
  'thi hanh an',
  'hai quan',
  'kiem lam',
  'quan ly thi truong',
];

/**
 * Rút địa bàn từ chuỗi "Tổ hình sự …". Trả về `undefined` nếu không phải dạng này.
 *   "Tổ Hình sự Quận 12"                    → "Quận 12"
 *   "Tổ hình sự quận Gò Vấp"                → "quận Gò Vấp"
 *   "Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)" → "TP. Thủ Đức"   (ưu tiên phần trong ngoặc)
 *   "Tổ Hình sự khu vực 7 (quận 12 cũ)"     → "quận 12"
 */
export function extractHinhSuArea(raw: string): string | undefined {
  // Bỏ tiền tố "BCH " (Ban chỉ huy) trước khi nhận dạng — dữ liệu thật có cả
  // "BCH Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)". Chấp nhận cả lỗi gõ "hính".
  const norm = normalizeVi(raw).replace(/^bch\s+/, '');
  if (!/^to\s+h[i]nh\s+su\b/.test(norm)) return undefined;

  // Dữ liệu thật lưu ở dạng Unicode TỔ HỢP (NFD): "cũ" = c + u + dấu ngã rời. Cắt đuôi
  // bằng chữ "cũ" sẽ trượt nếu không hợp nhất về NFC trước — lỗi này từng làm cả nhóm
  // "Tổ hình sự khu vực N (… cũ)" rơi vào diện chưa phân loại.
  const nfc = raw.normalize('NFC');
  const inParen = nfc.match(/\(([^)]+)\)/)?.[1];
  if (inParen) {
    // "TP. Thủ Đức cũ" → "TP. Thủ Đức"; chữ "cũ" chỉ là ghi chú thời điểm.
    const cleaned = stripCityPrefix(inParen.replace(/\s*c[ũu]\s*$/i, ''));
    if (cleaned) return cleaned;
  }
  // Bỏ cụm "Tổ hình sự" và phần "khu vực N" nếu có, còn lại là địa bàn.
  const rest = stripCityPrefix(
    nfc
      .replace(/^\s*bch\s+/i, '')
      .replace(/^\s*t[ổo]\s+h[ìíi]nh\s+s[ựu]\s*/i, '')
      .replace(/^kh[uư]\s*v[ựu]c\s*[0-9IVX]+\s*/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' '),
  );
  return rest || undefined;
}

/** Bỏ tiền tố cấp thành phố: "TP. Thủ Đức" → "Thủ Đức" (tổ theo địa bàn, không phải theo cấp). */
function stripCityPrefix(v: string): string {
  // "TP.Thủ Đức" (không có khoảng trắng sau dấu chấm) cũng phải nhận — dữ liệu thật có cả hai kiểu.
  return v.replace(/^\s*(tp\.\s*|tp\s+|thanh pho\s+|thành phố\s+)/i, '').trim();
}

export interface ClassifyResult {
  kind: AliasKind;
  teamKey?: string; // khoá khớp tổ (khi kind = TEAM)
  reason: string;
}

/**
 * Phân loại một giá trị thô.
 *
 * `teamKeys` là tập khoá `teamMatchKey` của mọi Tổ/Nhóm đang có — truyền vào để hàm
 * giữ được tính thuần (không tự truy vấn CSDL) và test được bằng dữ liệu cố định.
 */
export function classifyUnitValue(raw: string, teamKeys: Set<string>): ClassifyResult {
  const norm = normalizeVi(raw);
  if (!norm) return { kind: 'UNKNOWN', reason: 'giá trị rỗng' };

  // Kết quả xử lý xét TRƯỚC: "Trả đơn, chuyển Công an quận 1" vừa có dấu hiệu kết quả
  // vừa có tên đơn vị — bản chất nó là kết quả, không phải nơi thụ lý.
  for (const m of RESULT_MARKERS) {
    if (norm.startsWith(m)) return { kind: 'RESULT', reason: `bắt đầu bằng "${m}" — là kết quả xử lý` };
  }

  const key = teamMatchKey(raw);
  if (teamKeys.has(key)) return { kind: 'TEAM', teamKey: key, reason: 'khớp tên Tổ/Nhóm đang có' };

  // "PC02 Cơ sở 1 (Bình Dương)" — tiền tố đơn vị chủ quản làm lệch khoá khớp.
  if (/^pc02\s+/.test(norm)) {
    const stripped = raw.replace(/^\s*pc02\s+/i, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const k = teamMatchKey(stripped);
    if (k && teamKeys.has(k)) return { kind: 'TEAM', teamKey: k, reason: `bỏ tiền tố PC02 → "${stripped}"` };
  }

  // "Tổ hình sự <địa bàn>" là tổ hình sự đóng tại một địa bàn, không phải đơn vị riêng.
  // Dữ liệu thật có hàng chục cách viết: "Tổ Hình sự Quận 12", "Tổ hình sự quận Gò Vấp",
  // "BCH Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)".
  const hinhSu = extractHinhSuArea(raw);
  if (hinhSu) {
    const areaKey = teamMatchKey(hinhSu);
    if (teamKeys.has(areaKey)) {
      return { kind: 'TEAM', teamKey: areaKey, reason: `tổ hình sự đóng tại "${hinhSu}"` };
    }
  }

  for (const m of EXTERNAL_MARKERS) {
    if (norm.includes(m)) return { kind: 'EXTERNAL_ORG', reason: `chứa "${m}" — cơ quan ngoài` };
  }

  // "Đội 7/8/9" có trong hồ sơ nhưng KHÔNG có trong bảng đơn vị hệ cũ lẫn Tổ/Nhóm hệ mới.
  // Không tự tạo tổ — báo lên để người có thẩm quyền quyết định.
  if (/^(bch\s+)?doi\s+\d+/.test(norm)) {
    return { kind: 'UNKNOWN', reason: 'là một Đội nhưng chưa có trong danh sách Tổ/Nhóm — cần tạo hoặc chỉ định ánh xạ' };
  }

  return { kind: 'UNKNOWN', reason: 'chưa phân loại được' };
}

/** Gom các cách viết khác nhau của cùng một giá trị (sau chuẩn hoá) và cộng dồn số hồ sơ. */
export function groupRawValues(rows: { value: string | null; count: number }[]): Map<string, { sample: string; count: number }> {
  const out = new Map<string, { sample: string; count: number }>();
  for (const r of rows) {
    const raw = (r.value ?? '').trim();
    if (!raw) continue;
    const key = normalizeVi(raw);
    const cur = out.get(key);
    if (cur) cur.count += r.count;
    else out.set(key, { sample: raw, count: r.count });
  }
  return out;
}
