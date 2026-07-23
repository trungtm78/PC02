/**
 * Trích thông tin có cấu trúc từ phần tóm tắt viết tự do của hệ cũ.
 *
 * Vì sao cần: hệ cũ nhét toàn bộ diễn biến vào MỘT ô văn bản, các ô nghiệp vụ để trống.
 * Đo trên 3.283 vụ án đã di trú: chỉ 5% có số quyết định khởi tố, 2,5% có ngày khởi tố,
 * 0% có tội danh — trong khi những thông tin đó nằm ngay trong đoạn văn.
 *
 * Nguyên tắc: chỉ trích khi câu chữ nói rõ, KHÔNG suy diễn. Mỗi kết quả kèm đoạn trích
 * gốc để người dùng đối chiếu. Không chắc thì bỏ trống — ô trống trung thực hơn ô sai.
 */

export interface Extracted {
  /** Ngày ra quyết định khởi tố vụ án */
  ngayKhoiTo?: Date;
  /** Số quyết định khởi tố (nếu câu chữ có ghi số) */
  soQuyetDinhKhoiTo?: string;
  /** Tên tội danh trong ngoặc kép hoặc sau chữ "tội" */
  toiDanh?: string;
  /** Ngày xảy ra sự việc — ngày ĐẦU TIÊN được nhắc, thường là mở đầu diễn biến */
  ngayXayRa?: Date;
  /** Nơi xảy ra, lấy theo cụm "tại …" cho tới hết vế địa chỉ */
  diaDiem?: string;
  /** Việc chuyển vụ án cho cơ quan khác */
  chuyenVuAn?: string;
  /** Tiêu đề ngắn gọn để hiển thị trên danh sách */
  tieuDe?: string;
  /** Đoạn trích gốc cho từng thông tin, để người dùng đối chiếu */
  dauVet: Record<string, string>;
}

/** dd/mm/yyyy hoặc d/m/yyyy, chấp nhận cả dấu chấm và gạch ngang. */
const DATE_RE = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/;
const DATE_RE_G = new RegExp(DATE_RE.source, 'g');

function toDate(d: string, m: string, y: string): Date | undefined {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return undefined;
  const dt = new Date(Date.UTC(year, month - 1, day));
  // Chặn ngày tràn (31/02 bị JS đẩy sang 3/3).
  if (dt.getUTCDate() !== day || dt.getUTCMonth() + 1 !== month) return undefined;
  return dt;
}

function parseDateAt(text: string): Date | undefined {
  const m = DATE_RE.exec(text);
  return m ? toDate(m[1], m[2], m[3]) : undefined;
}

/** Lấy một đoạn ngữ cảnh quanh vị trí khớp, để làm dấu vết đối chiếu. */
function snippet(text: string, index: number, len = 90): string {
  const start = Math.max(0, index - 20);
  return text.slice(start, start + len).replace(/\s+/g, ' ').trim();
}

/**
 * Ngày khởi tố: tìm cụm "khởi tố vụ án" rồi lấy ngày GẦN NHẤT ĐỨNG TRƯỚC trong cùng câu.
 * Dữ liệu thật viết kiểu "Ngày 27/10/2016, Công an quận Tân Bình khởi tố vụ án …".
 */
export function extractNgayKhoiTo(text: string): { date?: Date; trace?: string } {
  const idx = text.search(/kh[ởo]i\s+t[ốo]\s+v[ụu]\s+[áa]n/i);
  if (idx < 0) return {};
  // Vế câu chứa cụm "khởi tố": từ dấu chấm/xuống dòng gần nhất trước đó.
  const start = Math.max(
    text.lastIndexOf('.', idx),
    text.lastIndexOf('\n', idx),
    text.lastIndexOf(';', idx),
  );
  const clause = text.slice(start + 1, idx);
  const dates = [...clause.matchAll(DATE_RE_G)];
  const last = dates[dates.length - 1];
  if (!last) return {};
  const d = toDate(last[1], last[2], last[3]);
  return d ? { date: d, trace: snippet(text, start + 1) } : {};
}

/** Số quyết định khởi tố, dạng "Quyết định khởi tố vụ án số 123" hoặc "số 123/QĐ-…". */
export function extractSoQuyetDinhKhoiTo(text: string): { so?: string; trace?: string } {
  const m = /kh[ởo]i\s+t[ốo][^.;\n]{0,60}?s[ốo]\s*[:]?\s*([0-9][0-9A-Za-zĐđ/.\-]{0,24})/i.exec(text);
  if (!m) return {};
  return { so: m[1].replace(/[.,;]+$/, ''), trace: snippet(text, m.index) };
}

/**
 * Tội danh: ưu tiên phần trong ngoặc kép ngay sau "khởi tố"/"về tội"; nếu không có ngoặc
 * kép thì lấy cụm sau chữ "tội". Bỏ các cụm quá dài (thường là câu văn, không phải tội danh).
 */
export function extractToiDanh(text: string): { ten?: string; trace?: string } {
  const quoted = /(?:kh[ởo]i\s+t[ốo][^"“”]{0,40}|v[ềe]\s+t[ộo]i\s*)["“]([^"”]{3,80})["”]/i.exec(text);
  if (quoted) return { ten: quoted[1].trim(), trace: snippet(text, quoted.index) };
  const plain = /t[ộo]i\s+["“]?([A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ][^".;\n"”]{3,60})/.exec(text);
  if (plain) return { ten: plain[1].trim().replace(/[,.;]+$/, ''), trace: snippet(text, plain.index) };
  return {};
}

/** Ngày xảy ra: ngày đầu tiên xuất hiện trong đoạn — hệ cũ luôn mở đầu bằng diễn biến. */
export function extractNgayXayRa(text: string): { date?: Date; trace?: string } {
  const m = DATE_RE.exec(text);
  if (!m) return {};
  const d = toDate(m[1], m[2], m[3]);
  return d ? { date: d, trace: snippet(text, m.index) } : {};
}

/** Nơi xảy ra: cụm sau "tại " cho tới hết vế (dấu phẩy cuối của chuỗi địa chỉ). */
export function extractDiaDiem(text: string): { noi?: string; trace?: string } {
  const m = /\bt[ạa]i\s+([^.;\n]{5,120})/i.exec(text);
  if (!m) return {};
  let v = m[1].trim();
  // Cắt ở động từ mở đầu mệnh đề tiếp theo ("thì bị", "xảy ra", "do")
  v = v.split(/\s+(?:th[ìi]\s|x[ảa]y\s+ra|do\s|khi\s)/i)[0].trim();
  v = v.replace(/[,;]+$/, '');
  if (v.length < 5) return {};
  return { noi: v, trace: snippet(text, m.index) };
}

/** Việc chuyển vụ án sang cơ quan khác. */
export function extractChuyenVuAn(text: string): { noiDung?: string; trace?: string } {
  const m = /chuy[ểe]n\s+v[ụu]\s+[áa]n[^.;\n]{0,120}/i.exec(text);
  if (!m) return {};
  return { noiDung: m[0].trim().replace(/[,;]+$/, ''), trace: snippet(text, m.index) };
}

/**
 * Tiêu đề ngắn để hiển thị trên danh sách.
 *
 * Ưu tiên: "<Tội danh> — <địa điểm> (dd/mm/yyyy)". Không đủ dữ kiện thì lấy câu đầu,
 * cắt ở 120 ký tự theo ranh giới TỪ để không cắt ngang chữ.
 */
export function buildTieuDe(text: string, ex: Pick<Extracted, 'toiDanh' | 'diaDiem' | 'ngayXayRa'>): string {
  const parts: string[] = [];
  if (ex.toiDanh) parts.push(ex.toiDanh);
  if (ex.diaDiem) parts.push(ex.diaDiem.length > 60 ? `${ex.diaDiem.slice(0, 57).trimEnd()}…` : ex.diaDiem);
  let head = parts.join(' — ');
  if (!head) {
    head = text.split(/(?<=[.;])\s/)[0] ?? text;
  }
  if (ex.ngayXayRa) {
    const d = ex.ngayXayRa;
    head += ` (${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()})`;
  }
  head = head.replace(/\s+/g, ' ').trim();
  if (head.length <= 120) return head;
  const cut = head.slice(0, 120);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Chạy toàn bộ phép trích trên một đoạn văn. */
export function extractAll(text: string): Extracted {
  const out: Extracted = { dauVet: {} };
  if (!text || text.trim().length < 20) return out;

  const kt = extractNgayKhoiTo(text);
  if (kt.date) {
    out.ngayKhoiTo = kt.date;
    out.dauVet.ngayKhoiTo = kt.trace!;
  }
  const so = extractSoQuyetDinhKhoiTo(text);
  if (so.so) {
    out.soQuyetDinhKhoiTo = so.so;
    out.dauVet.soQuyetDinhKhoiTo = so.trace!;
  }
  const td = extractToiDanh(text);
  if (td.ten) {
    out.toiDanh = td.ten;
    out.dauVet.toiDanh = td.trace!;
  }
  const xr = extractNgayXayRa(text);
  if (xr.date) {
    out.ngayXayRa = xr.date;
    out.dauVet.ngayXayRa = xr.trace!;
  }
  const dd = extractDiaDiem(text);
  if (dd.noi) {
    out.diaDiem = dd.noi;
    out.dauVet.diaDiem = dd.trace!;
  }
  const cv = extractChuyenVuAn(text);
  if (cv.noiDung) {
    out.chuyenVuAn = cv.noiDung;
    out.dauVet.chuyenVuAn = cv.trace!;
  }
  out.tieuDe = buildTieuDe(text, out);
  return out;
}
