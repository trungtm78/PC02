/**
 * Bóc đối tượng / bị can / bị hại từ phần tóm tắt tự do của hồ sơ.
 *
 * Vì sao cần: bảng `bi_can` của hệ cũ RỖNG (0 byte trong dump), nhưng thông tin nhân thân
 * lại nằm rải trong `tom_tat_noi_dung` — 16.048 hồ sơ có "SN:", 5.257 có chuỗi 12 số, 528
 * có hộ chiếu. Đây là nguồn duy nhất còn lại để dựng danh sách đối tượng.
 *
 * Nguyên tắc XUYÊN SUỐT: ô trống trung thực hơn ô sai. Chỉ bóc khi mẫu RÕ RÀNG — một cụm
 * tên viết hoa đứng NGAY TRƯỚC "SN:"/"sinh năm". Không đủ tin thì bỏ, không đoán tên.
 *
 * Phân loại bằng TIÊU CHÍ DUY NHẤT (anh yêu cầu): CCCD (12 số) → CMND (9 số) → hộ chiếu →
 * SĐT. Hai đối tượng cùng số định danh là cùng một người, kể cả ở hai hồ sơ khác nhau.
 */

export type VaiTro = 'SUSPECT' | 'VICTIM' | 'UNKNOWN';

export interface DoiTuong {
  hoTen: string;
  namSinh?: number;
  cccd?: string; // 12 số
  cmnd?: string; // 9 số
  hoChieu?: string;
  soDienThoai?: string;
  diaChi?: string;
  quocTich?: string;
  vaiTro: VaiTro;
  /** khoá định danh duy nhất để khử trùng: cccd > cmnd > hoChieu > sđt > (tên+năm sinh) */
  khoaDinhDanh: string;
  /** đoạn trích gốc để người rà soát đối chiếu */
  trichDan: string;
}

// Một từ trong tên người VN hoặc tên nước ngoài: bắt đầu bằng chữ IN HOA (có dấu), theo
// sau là chữ thường/hoa. Chấp nhận cả tên viết hoa toàn bộ (ELENA) lẫn hoa đầu (Nguyễn).
const TU_TEN = '[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ][a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđA-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]*';
// Cụm tên: 2–5 từ. Người VN thường 3–4 từ; tên nước ngoài có thể dài hơn nhưng cắt ở 5.
const TEN = `${TU_TEN}(?:\\s+${TU_TEN}){1,4}`;

// "SN: 1998", "SN 1998", "sinh năm 1998", "sinh ngày ../../1998"
const SN = '(?:SN|sinh\\s*năm|sinh\\s*ngày[^0-9]{0,12})[:\\s]*([0-9]{4})';

/** Danh xưng đứng trước tên — dùng để cắt biên trái, không lẫn từ phía trước vào tên. */
const DANH_XUNG = /(?:^|[\s(,;.])(?:ông|bà|anh|chị|em|cháu|đối\s*tượng|bị\s*can|bị\s*hại|nạn\s*nhân|nghi\s*can|người\s*bị\s*hại|các\s*đối\s*tượng)\s*:?\s*$/i;

/** Chuẩn hoá số định danh: bỏ mọi ký tự không phải chữ/số. */
const chuanSo = (v: string): string => v.replace(/[^0-9A-Za-z]/g, '');

/**
 * Từ một vị trí tên trong văn bản, dò các thuộc tính ở NGAY SAU (trong ~200 ký tự).
 */
function bocThuocTinh(text: string, from: number): Partial<DoiTuong> {
  const seg = text.slice(from, from + 200);
  const out: Partial<DoiTuong> = {};

  const cccd = seg.match(/(?:CCCD|căn\s*cước)[^0-9]{0,10}([0-9]{12})|(?<![0-9])([0-9]{12})(?![0-9])/i);
  if (cccd) out.cccd = cccd[1] ?? cccd[2];

  const cmnd = seg.match(/(?:CMND|CMTND|CMT)[^0-9]{0,10}([0-9]{9})(?![0-9])/i);
  if (cmnd) out.cmnd = cmnd[1];

  const hc = seg.match(/(?:hộ\s*chiếu|passport)[^0-9A-Za-z]{0,10}([A-Z]{0,2}[0-9]{6,9})/i);
  if (hc) out.hoChieu = chuanSo(hc[1]);

  const sdt = seg.match(/(?:ĐT|SĐT|điện\s*thoại|số\s*ĐT)[^0-9]{0,6}(0[0-9]{9})(?![0-9])/i);
  if (sdt) out.soDienThoai = sdt[1];

  const dc = seg.match(/(?:HKTT|hộ\s*khẩu(?:\s*thường\s*trú)?|thường\s*trú|tạm\s*trú|ngụ|chỗ\s*ở|nơi\s*ở)[:\s]*([^;()]{6,120})/i);
  if (dc) out.diaChi = dc[1].split(/\s+(?:th[ìi]\s|đi\s|điều\s*khiển|đến\s)/i)[0].replace(/[,.;]+$/, '').trim();

  const qt = seg.match(/(?:QT|quốc\s*tịch)[:\s]*([^;()0-9]{2,40})/i);
  if (qt) out.quocTich = qt[1].replace(/[,.;]+$/, '').trim();

  return out;
}

/**
 * Suy vai trò theo NGỮ CẢNH. Hệ cũ hay viết "Đối tượng: A (…); B (…); bị hại: C (…)" —
 * một nhãn vai trò áp cho MỌI tên tiếp sau cho tới khi gặp nhãn khác. Chỉ nhìn 120 ký tự
 * ngay trước tên: nhãn nào GẦN tên nhất thì thắng.
 *
 * Nguyên tắc chống vu oan: chỉ trả SUSPECT/VICTIM khi có nhãn rõ. Không có nhãn nào →
 * UNKNOWN, và caller KHÔNG tạo bản ghi bị can cho nhóm này.
 */
function suyVaiTro(text: string, tenStart: number): VaiTro {
  const truoc = text.slice(Math.max(0, tenStart - 120), tenStart).toLowerCase();
  const viHai = Math.max(truoc.lastIndexOf('bị hại'), truoc.lastIndexOf('nạn nhân'), truoc.lastIndexOf('người bị hại'));
  const viCan = Math.max(
    truoc.lastIndexOf('đối tượng'),
    truoc.lastIndexOf('bị can'),
    truoc.lastIndexOf('nghi can'),
    truoc.lastIndexOf('các đối tượng'),
  );
  if (viHai < 0 && viCan < 0) return 'UNKNOWN';
  return viHai > viCan ? 'VICTIM' : 'SUSPECT';
}

/**
 * Bóc mọi đối tượng có mẫu "Tên … SN: yyyy" trong đoạn văn.
 * Khử trùng NGAY trong một hồ sơ theo khoá định danh.
 */
export function bocDoiTuong(text: string): DoiTuong[] {
  if (!text || text.length < 15) return [];
  const re = new RegExp(`(${TEN})\\s*[,(;]?\\s*${SN}`, 'g');
  const ketQua = new Map<string, DoiTuong>();

  for (const m of text.matchAll(re)) {
    let hoTen = m[1].trim();
    const namSinh = Number(m[2]);
    if (namSinh < 1920 || namSinh > 2025) continue; // năm sinh vô lý → bỏ

    // Cắt danh xưng lẫn ở đầu tên ("bà ELENA" → tên bắt đầu ở "ELENA": regex đã tránh,
    // nhưng "Đối tượng Nguyễn" có thể lọt "Đối" nếu viết hoa) — bỏ từ đầu nếu là danh xưng.
    hoTen = hoTen.replace(/^(Ông|Bà|Anh|Chị|Em|Cháu|Đối|Bị|Nghi)\s+(?=[A-ZÀ-Ỹ])/, (s0) =>
      /^(Đối|Bị|Nghi)\s/.test(s0) ? s0 : '',
    ).trim();
    if (hoTen.split(/\s+/).length < 2) continue; // tên phải ≥ 2 từ

    const tenStart = m.index ?? 0;
    const tt = bocThuocTinh(text, tenStart);
    const vaiTro = suyVaiTro(text, tenStart);

    const khoa =
      tt.cccd ? `cccd:${tt.cccd}` :
      tt.cmnd ? `cmnd:${tt.cmnd}` :
      tt.hoChieu ? `hc:${tt.hoChieu}` :
      tt.soDienThoai ? `sdt:${tt.soDienThoai}` :
      `ten:${hoTen.toLowerCase()}|${namSinh}`;

    if (ketQua.has(khoa)) continue; // trùng trong cùng hồ sơ
    ketQua.set(khoa, {
      hoTen,
      namSinh,
      ...tt,
      vaiTro,
      khoaDinhDanh: khoa,
      trichDan: text.slice(tenStart, tenStart + 110).replace(/\s+/g, ' ').trim(),
    });
  }
  return [...ketQua.values()];
}
