// Lõi di trú: map 1 record hệ thống cũ (132 field flat, tên cột cũ) → các entity mới CÓ LIÊN KẾT.
// Thuần (testable). Tội danh trả về crimeChinhLegacyValue (số) — commit resolve sang crimeChinhId qua master Crime.
import { PARITY, type Entity as ParityEntity } from './field-parity.def';
import { docSoDienThoaiHeCu } from './so-dien-thoai-he-cu';

export type LegacyRecord = Record<string, unknown>;

export interface DecomposedEntities {
  petition?: Record<string, unknown>;
  incident?: Record<string, unknown>;
  case?: Record<string, unknown>;
  statistic?: Record<string, unknown>; // case_statistics 1-1 (gắn vào case)
  // Tier ③ (PR-M3): các loại record nghiệp vụ phụ hệ cũ.
  guidance?: Record<string, unknown>; // huong-dan-ban-dau → GuidanceRecord
  exchange?: Record<string, unknown>; // trao-doi-chuyen-an → Exchange
  proposal?: Record<string, unknown>; // kien-nghi-vks → Proposal (proposalNumber sinh ở commit)
  lawyer?: Record<string, unknown>; // luat-su → Lawyer (gắn vào host Case)
  // Gợi ý caseProvenance khi tạo Case standalone (không phải decompose 1→nhiều).
  // Commit ưu tiên FROM_PETITION/FROM_INCIDENT nếu record cũng sinh petition/incident.
  caseProvenanceHint?: string;
  warnings: string[];
}

// Cờ boolean suy từ text tự do: ưu tiên nhãn rõ ("Không/Chưa"→false) qua parseLegacyBool; nếu là
// text mô tả tự do (vd "Đã báo cáo BGĐ ngày...") ⇒ true. Rỗng ⇒ undefined. Text gốc giữ ở legacyRaw.
const boolFromText = (v: unknown): boolean | undefined => {
  const b = parseLegacyBool(v);
  if (b !== undefined) return b;
  return s(v) !== undefined ? true : undefined;
};

const s = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  // String(v) có thể THROW với object adversarial (vd {toString:[]} — JSON hợp lệ admin dán):
  // "Cannot convert object to primitive value". Bọc try để parser KHÔNG crash (fuzzing FZ-04).
  let str: string;
  try {
    str = String(v).trim();
  } catch {
    return undefined;
  }
  return str === '' ? undefined : str;
};

const num = (v: unknown): number | undefined => {
  const str = s(v);
  if (str === undefined) return undefined;
  const n = Number(str);
  return Number.isNaN(n) ? undefined : n;
};

// Phân tích số tiền/đếm hệ cũ: phân tách nghìn VN (1.000.000 / 1,000,000), thập phân VN (1,5),
// hệ số nhân chữ ("triệu" → 1e6, "tỷ" → 1e9, "nghìn/ngàn" → 1e3). Convert lỗi → undefined (caller warn + giữ raw).
export function parseLegacyNumber(v: unknown): number | undefined {
  const raw = s(v);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  let multiplier = 1;
  if (lower.includes('tỷ') || lower.includes('tỉ')) multiplier = 1e9;
  else if (lower.includes('triệu') || lower.includes('trieu')) multiplier = 1e6;
  else if (lower.includes('nghìn') || lower.includes('nghin') || lower.includes('ngàn') || lower.includes('ngan')) multiplier = 1e3;
  // Giữ lại chữ số, dấu . , -
  let core = lower.replace(/[^0-9.,-]/g, '');
  if (core === '' || core === '-') return undefined;
  const hasDot = core.includes('.');
  const hasComma = core.includes(',');
  if (hasDot && hasComma) {
    const dec = core.lastIndexOf(',') > core.lastIndexOf('.') ? ',' : '.';
    const tho = dec === ',' ? '.' : ',';
    core = core.split(tho).join('').replace(dec, '.');
  } else if (hasComma) {
    const parts = core.split(',');
    core = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join('');
  } else if (hasDot) {
    const parts = core.split('.');
    if (!(parts.length === 2 && parts[1].length !== 3)) core = parts.join(''); // dấu chấm = nghìn
  }
  const n = parseFloat(core);
  return Number.isNaN(n) ? undefined : n * multiplier;
}

// Phân tích nhãn boolean tiếng Việt. Rỗng → undefined (phân biệt "thiếu" vs false — Codex P1#6).
// Nhận cả cụm từ theo TỪ ĐẦU ("Đã xét xử"→true, "Không có"→false) — review correctness.
// LƯU Ý thứ tự: check NEGATIVE trước ("chưa..." chứa nhưng không phải "có"); "không" đầu câu = false.
export function parseLegacyBool(v: unknown): boolean | undefined {
  const str = s(v);
  if (str === undefined) return undefined;
  const t = str.toLowerCase();
  // (\s|$) thay cho \b — tránh lỗi word-boundary ASCII với ký tự tiếng Việt.
  if (/^(không|khong|chưa|chua|false|0|no)(\s|$)/.test(t)) return false;
  if (/^(có|co|đã|da|rồi|roi|true|x|1|yes)(\s|$)/.test(t)) return true;
  return undefined;
}

// Epoch giây hệ cũ: dải hợp lệ + độ lệch phải bù. Xem giải thích trong parseLegacyDate.
const LEGACY_EPOCH_MIN = 946684800; // 2000-01-01T00:00:00Z
const LEGACY_EPOCH_MAX = 2524608000; // 2050-01-01T00:00:00Z
export const LEGACY_EPOCH_SHIFT_SECONDS = 50400; // +14h — đo khớp 100,00% trên 53.795/53.796 hồ sơ

/**
 * Khoá chống trùng khi di trú. PHẢI kèm tên collection nguồn.
 *
 * Đo thực tế trên dump: `ho_so.id` = [1,2,3,4] TRÙNG 100% với id của `ho_so_doi_1`
 * (chạy liên tục 1…53.820). Vì `legacySourceId` là `@unique` trên từng bảng, khoá trần
 * khiến 4 hồ sơ 01/2026 GHI ĐÈ 4 hồ sơ 2017 — mất dữ liệu im lặng.
 *
 * Không có `__sourceCollection` thì giữ khoá trần để tương thích ngược (bộ test golden/expert
 * hiện có dùng id trần). Công cụ nạp LUÔN gắn trường này; preflight chặn bằng `legacyKeyVersion`
 * nếu sổ chạy ghi phiên bản khoá khác với phiên bản đang chạy.
 */
export function legacyKey(rec: LegacyRecord): string | undefined {
  const id = s(rec.id);
  if (id === undefined) return undefined;
  const col = s(rec.__sourceCollection);
  return col ? `${col}:${id}` : id;
}

/**
 * Field TRUY NGUYÊN hệ cũ (PR-2): STT sổ thụ lý + id số gốc + collection gốc.
 * `legacyId`+`legacyCollection` collision-safe (id trùng giữa ho_so/ho_so_doi_1).
 * `soHoSoCu` = STT hiển thị/tìm kiếm để tra ngược bản ghi gốc.
 * CHỈ áp cho entity có cột (Case/Incident/Petition) — xem schema PR-2.
 */
export function traceFields(rec: LegacyRecord): {
  soHoSoCu?: string;
  legacyId?: number;
  legacyCollection?: string;
} {
  const idStr = s(rec.id);
  const legacyId = idStr !== undefined && /^\d+$/.test(idStr) ? Number(idStr) : undefined;
  const legacyCollection = s(rec.__sourceCollection);
  const soHoSoCu = s(rec.stt) ?? s(rec.stt_cu);
  return { soHoSoCu, legacyId, legacyCollection };
}

// Chuyển ngày hệ thống cũ (dd/mm/yyyy, yyyy-mm-dd, hoặc Excel serial) → Date.
// Dùng roundtrip check để từ chối ngày âm lịch/overflow (vd 31/02/2025 → wrap sang 3/3 mà không bị bắt).
export function parseLegacyDate(v: unknown): Date | undefined {
  // Excel serial: CHỈ khi value là NUMBER (cell numeric). KHÔNG nhận chuỗi toàn số — tránh nhận nhầm
  // mã/số quyết định/hồ sơ 5-6 chữ số thành ngày (review: silent corruption). Range ≈ năm 2000-2050.
  if (typeof v === 'number' && v >= 36526 && v <= 54789) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Epoch giây (dump MongoDB hệ cũ). Dải ≈ 2000-01-01 → 2050-01-01, KHÔNG chồng lấn dải Excel serial
  // ở trên (54789 ≪ 946684800) nên hai nhánh không tranh nhau. Chỉ nhận NUMBER, cùng lý do như trên.
  //
  // LỆCH MÚI GIỜ +14h — đo trên 53.796 hồ sơ có đủ ngay/thang/nam để đối chiếu:
  //   đọc theo UTC    → khớp      0 (0,00%)
  //   epoch +7h  (VN) → khớp      0 (0,00%)
  //   epoch +50400s   → khớp 53.795 (100,00%)
  // `value % 86400 = 36000` (10:00 UTC) ở 100,00% giá trị — dấu hiệu PHP cũ trừ offset +7 HAI LẦN,
  // nhất quán với sentinel rỗng -25200. Sentinel 0 / -25200 nằm ngoài dải nên tự rơi về undefined.
  if (typeof v === 'number' && v >= LEGACY_EPOCH_MIN && v <= LEGACY_EPOCH_MAX) {
    const shifted = new Date((v + LEGACY_EPOCH_SHIFT_SECONDS) * 1000);
    if (Number.isNaN(shifted.getTime())) return undefined;
    // Cắt về nửa đêm UTC: ngày nghiệp vụ, không phải mốc thời gian.
    return new Date(
      Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
    );
  }
  const str = s(v);
  if (!str) return undefined;
  let year: number, month: number, day: number;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m) {
    day = Number(m[1]); month = Number(m[2]); year = Number(m[3]);
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
    if (!m) return undefined;
    year = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return undefined;
  // Roundtrip: JS wraps overflow (31/02 → 3/3). Reject nếu UTC day/month/year khác input.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return undefined;
  }
  return d;
}

/**
 * Chuẩn hoá phân loại nguồn tin.
 *
 * Mapper chỉ nhận 11 giá trị chuẩn (dạng slug), nhưng dump thật có 16 cách viết —
 * 721 hồ sơ rơi ra ngoài, không sinh được thực thể nào: `huong-dan` (539),
 * `"vụ việc"` có dấu (89), `""` (85), `"vụ việc "` thừa khoảng trắng (7), `"vụ án"` (1).
 *
 * Hai bước: (1) bỏ dấu + trim + gộp khoảng trắng thành slug rồi tra bảng biến thể;
 * (2) nếu vẫn trống thì dùng `rec.loai` làm NGUỒN DỰ PHÒNG — trường này mapper chưa hề
 * đọc, mà nó sạch hơn (12 giá trị so với 16).
 */
const stripDiacritics = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const toSlug = (v: string): string =>
  // Gạch dưới cũng là dấu phân cách: hệ cũ ghi cả `don_thu` lẫn `don-cong-van-ban-dau`.
  stripDiacritics(v).toLowerCase().trim().replace(/[\s_]+/g, '-');

// Biến thể quan sát được trong dump → giá trị chuẩn mapper đang hiểu.
const PHAN_LOAI_ALIAS: Record<string, string> = {
  'vu-viec': 'vu-viec-ban-dau',
  'vu-an': 'vu-an-ban-dau',
  don: 'don-cong-van-ban-dau',
  'don-thu': 'don-cong-van-ban-dau',
  'huong-dan': 'huong-dan-ban-dau',
  'tra-ho-so': 'tra-ho-so-ban-dau',
  // Hồ sơ do công an phường/xã lập — vẫn là vụ án / vụ việc, chỉ khác nơi lập.
  'vu-an-phuong-xa': 'vu-an-ban-dau',
  'vu-viec-phuong-xa': 'vu-viec-ban-dau',
};

export function normalizePhanLoai(rec: LegacyRecord): string | undefined {
  for (const raw of [rec.phan_loai_nguon_tin_ban_dau, rec.loai]) {
    const str = s(raw);
    if (str === undefined) continue;
    const slug = toSlug(str);
    const resolved = PHAN_LOAI_ALIAS[slug] ?? slug;
    if (ALL_PHAN_LOAI.has(resolved)) return resolved;
  }
  return undefined;
}

const PHAN_LOAI_DON = new Set(['don-cong-van-ban-dau']);
const PHAN_LOAI_VU_VIEC = new Set(['vu-viec-ban-dau', 'vu-viec-nguon-tin']);
const PHAN_LOAI_VU_AN = new Set(['vu-an-ban-dau']);
// Tier ③ — 5 loại trước đây bị skip im lặng + luật sư + ủy thác (PR-M3).
const PHAN_LOAI_GUIDANCE = new Set(['huong-dan-ban-dau']);
const PHAN_LOAI_EXCHANGE = new Set(['trao-doi-chuyen-an']);
const PHAN_LOAI_PROPOSAL = new Set(['kien-nghi-vks']);
const PHAN_LOAI_UY_THAC = new Set(['uy-thac-dieu-tra']);
const PHAN_LOAI_LAWYER = new Set(['luat-su']);
const PHAN_LOAI_TRA_HO_SO = new Set(['tra-ho-so-ban-dau']);
const PHAN_LOAI_CONG_VAN_TDC = new Set(['cong-van-don-doc-phuc-hoi-tdc']);

// Tập hợp mọi giá trị hợp lệ — dùng cho normalizePhanLoai để quyết định có nhận hay không.
const ALL_PHAN_LOAI = new Set<string>([
  ...PHAN_LOAI_DON,
  ...PHAN_LOAI_VU_VIEC,
  ...PHAN_LOAI_VU_AN,
  ...PHAN_LOAI_GUIDANCE,
  ...PHAN_LOAI_EXCHANGE,
  ...PHAN_LOAI_PROPOSAL,
  ...PHAN_LOAI_UY_THAC,
  ...PHAN_LOAI_LAWYER,
  ...PHAN_LOAI_TRA_HO_SO,
  ...PHAN_LOAI_CONG_VAN_TDC,
]);


/**
 * Chủ sở hữu và tổ phụ trách — do BỘ NẠP tính sẵn rồi gắn vào bản ghi dưới dạng khoá `__`.
 *
 * Mapper là hàm thuần, không tra được CSDL, nên không tự đổi `nguoi_them` (số) thành id
 * người dùng hay `don_vi_giai_quyet` (chuỗi) thành id tổ được. Bộ nạp nạp sẵn bảng tra cứu
 * rồi truyền xuống qua ba khoá này.
 *
 * Vì sao BẮT BUỘC phải có: theo scope-filter, Vụ việc/Vụ án lọc theo `investigatorId`,
 * Đơn thư lọc theo `enteredById`. Bản ghi không gắn ai vẫn hiện với PC02 nhưng ẩn hoàn
 * toàn với cán bộ tổ — nghĩa là di trú xong mà cán bộ không thấy hồ sơ của chính mình.
 */
const ownership = (rec: LegacyRecord) => ({
  enteredById: s(rec.__enteredById),
  createdById: s(rec.__createdById),
  investigatorId: s(rec.__investigatorId),
  assignedTeamId: s(rec.__assignedTeamId),
});

/**
 * Cột field-parity: đổ MỌI field cũ có data vào cột typed đúng nghĩa của thực thể (spec
 * `field-parity.spec.ts`, sinh từ ma trận data thật). Spread ĐẦU builder → assignment
 * tường minh phía sau (nếu có) vẫn thắng. Field thủ tục leak chéo-giai-đoạn count nhỏ
 * KHÔNG ở đây (giữ metadata/legacyRaw). legacyRaw luôn giữ bản gốc = không mất data.
 */
/**
 * Đọc một ô SỐ của hệ cũ, hiểu "0" trần là Ô TRỐNG.
 *
 * Hệ cũ tự điền "0" vào ô số để trống. Đo trên máy thật 26/08/2026: 30.089 đơn thư có
 * `soTienBiThietHai = 0` và 30.956 đơn có `soLuongBiHai = 0`, trong khi chỉ 1.447 và 599 hồ sơ
 * mang số thật khác 0. Trong hồ sơ pháp lý, "thiệt hại 0 đồng" là một KHẲNG ĐỊNH còn "chưa
 * có số liệu" là chưa biết — báo cáo thống kê cộng nhầm hai nhóm ấy vào nhau.
 *
 * Cùng một lớp với hai mốc rỗng `"0"` và `"-25200"` mà `parseLegacyDate` đã xử cho ô ngày.
 *
 * "0 người" hay "0 đồng" viết kèm đơn vị thì giữ lại: đó là cán bộ CHỦ Ý ghi số không.
 */
/**
 * Số điện thoại hệ cũ sau khi đã bỏ ký hiệu "không có" và dấu phân cách.
 *
 * Trả `undefined` khi ô ấy không phải số — `clean()` sẽ bỏ khoá, nên cột để trống thay vì
 * mang một chuỗi mà chính hệ mới từ chối.
 */
export function soDienThoaiSachHeCu(v: unknown): string | undefined {
  const raw = s(v);
  const doc = docSoDienThoaiHeCu(raw ?? null);
  if (doc.loai === 'khong-co') return undefined;
  if (doc.loai === 'chuan-hoa') return doc.giaTri;
  return raw;
}

export function parseLegacySoLieu(v: unknown): number | undefined {
  const raw = s(v);
  if (raw === undefined) return undefined;
  if (raw.trim() === "0") return undefined;
  return parseLegacyNumber(v);
}
export function parityColumns(rec: LegacyRecord, entity: ParityEntity): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { field, col, type, textBool } of PARITY[entity]) {
    let v: unknown;
    switch (type) {
      case 'String': v = s(rec[field]); break;
      case 'DateTime': v = parseLegacyDate(rec[field]); break;
      case 'Int': { const n = parseLegacySoLieu(rec[field]); v = n === undefined ? undefined : Math.round(n); break; }
      case 'Float': v = parseLegacySoLieu(rec[field]); break; // tiền — không round, không giới hạn Int
      case 'Boolean': v = textBool ? boolFromText(rec[field]) : parseLegacyBool(rec[field]); break;
    }
    if (v !== undefined) out[col] = v;
  }
  return out;
}

// Field tiếp nhận chung (người gửi / nội dung) — dùng cho Petition.
function buildPetition(rec: LegacyRecord): Record<string, unknown> {
  const own = ownership(rec);
  return clean({
    ...parityColumns(rec, 'petition'),
    legacySourceId: legacyKey(rec),
    ...traceFields(rec),
    enteredById: own.enteredById,
    assignedTeamId: own.assignedTeamId,
    senderName: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
    // Hệ cũ để gõ tự do: 4.693 hồ sơ mang KÝ HIỆU "không có" (`...`, `0000`, `Không`) thay vì
    // số. Đổ thẳng vào thì hồ sơ mở ra bị chặn Lưu bởi một ô cán bộ không có gì để sửa cho
    // đúng. Xem `so-dien-thoai-he-cu.ts`.
    senderPhone: soDienThoaiSachHeCu(rec.so_dien_thoai_nguyen_don),
    senderBirthYear: s(rec.sinh_nam_nguoi_to_giac),
    senderIdNumber: s(rec.so_cccd_nguyen_don),
    senderIdIssueDate: parseLegacyDate(rec.ngay_cap_cccd_nguyen_don),
    senderIdIssuePlace: s(rec.noi_cap_cccd_nguyen_don),
    senderAddress: s(rec['dia-chi-bi-hai']),
    suspectedPerson: s(rec.nghi_van_doi_tuong),
    summary: s(rec.tom_tat_noi_dung),
    // Hệ cũ có ĐÚNG MỘT ô nội dung (`tom_tat_noi_dung`), form hệ mới hiện nó ở ô
    // "Tóm tắt nội dung" — ô ấy đọc `detailContent`, còn `summary` bị ẩn và được suy lại từ
    // `detailContent` mỗi lần lưu. Chỉ đổ vào `summary` thì cán bộ mở hồ sơ di trú ra thấy ô
    // nội dung TRẮNG dù chữ vẫn nằm trong bảng, và bấm Lưu thì bị chặn vì "Nội dung là bắt
    // buộc". Đo trên máy chạy 27/08/2026: cả 46.499 hồ sơ di trú đều vướng.
    detailContent: s(rec.tom_tat_noi_dung),
    attachmentsNote: s(rec.do_vat_tai_lieu_kem_theo),
    nguonDon: s(rec.nguon_don),
    loaiThongTin: s(rec.loai_thong_tin),
    soPhieuChuyen: s(rec.so_phieu_chuyen),
    ngayPhieuChuyen: parseLegacyDate(rec.ngay_phieu_chuyen),
    ngayTiepNhanNguonTin: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin),
    toiDanhBanDau: s(rec['toi-danh-ban-dau']),
    crimeChinhLegacyValue: num(rec.toi_danh_chinh_blhs2015),
    noiXayRa: s(rec.noi_xay_ra),
    noiXayRaPhuongXa: s(rec.noi_xay_ra_phuong_xa),
    ngayXayRa: parseLegacyDate(rec.ngay_xay_ra),
    loaiToiPham: s(rec.loai_toi_pham),
    phuongThucThuDoan: s(rec.phuong_thuc_thu_doan),
    ngayGiaoDonViGiaiQuyet: parseLegacyDate(rec.ngay_giao_don_vi_giai_quyet),
    lanhDaoToTung: s(rec.lanh_dao_to_tung),
    ketQuaXuLyKhac: s(rec.ket_qua_xu_ly_giai_quyet_khac),
    receivedDate: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin) ?? parseLegacyDate(rec.ngay_de_xuat),
    petitionDate: parseLegacyDate(rec.ngay_viet_don),
    nhanThay: s(rec.nhan_xet),
    raSoatTrung: s(rec.ghi_chu_trung_don),
    // Field-parity nhóm B bổ sung
    laCongNgheCao: parseLegacyBool(rec.phan_loai_toi_pham_cong_nghe_cao),
    baoCaoBanGiamDoc: boolFromText(rec.truong_hop_bao_cao_ban_giam_doc),
    thoiHanUTDT: parseLegacyDate(rec.thoi_han_thuc_hien_uy_thac_dieu_tra),
    legacyRaw: { ...rec },
  });
}

/**
 * Tiêu đề ngắn gọn cho Vụ án.
 *
 * Hệ cũ nhét CẢ đoạn diễn biến vào một ô, nên nếu bê nguyên sang `name` thì danh sách
 * Vụ án chỉ toàn những dòng dài cả trang. Ở đây rút gọn: ưu tiên tội danh + nơi xảy ra,
 * không có thì lấy câu đầu; toàn văn KHÔNG mất, nằm ở `metadata.description` ("Mô tả
 * chi tiết" trên form).
 */
export function caseTitle(rec: LegacyRecord): string {
  const toiDanh = s(rec['toi-danh-ban-dau']);
  const noi = s(rec.noi_xay_ra) ?? s(rec.noi_xay_ra_phuong_xa);
  const parts = [toiDanh, noi].filter(Boolean) as string[];
  let head = parts.join(' — ');
  if (!head) {
    const full = s(rec.tom_tat_noi_dung);
    if (!full) return 'Vụ án di trú ' + (s(rec.id) ?? '');
    head = full.split(/(?<=[.;])\s/)[0] ?? full;
  }
  head = head.replace(/\s+/g, ' ').trim();
  if (head.length <= 120) return head;
  const cut = head.slice(0, 120);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}

function buildIncident(rec: LegacyRecord): Record<string, unknown> {
  const own = ownership(rec);
  return clean({
    ...parityColumns(rec, 'incident'),
    // Các cột dưới đây nhánh Đơn thư đã đọc từ lâu, nhánh Vụ việc thì không —
    // nên hồ sơ vào hệ thống mà mọi ô nghiệp vụ đều trống. Xem bảng rà soát 80 cột.
    // `nguonPhatTin` là ENUM (NguonPhatTin) chứ không phải chữ tự do — đổ tên đơn vị
    // vào đó là Prisma từ chối cả bản ghi. Nguồn đơn thực chất là đơn vị chuyển đến.
    chuyenTuDonVi: s(rec.nguon_don),
    tinhTrangHoSo: s(rec.tinh_trang),
    diaChiNguoiToGiac: s(rec['dia-chi-bi-hai']),
    ngayDeXuat: parseLegacyDate(rec.ngay_de_xuat),
    ketQuaXuLy: s(rec.ket_qua_xu_ly_giai_quyet_khac),
    legacySourceId: legacyKey(rec),
    ...traceFields(rec),
    createdById: own.createdById,
    investigatorId: own.investigatorId,
    assignedTeamId: own.assignedTeamId,
    name: s(rec.tom_tat_noi_dung) ?? 'Vụ việc di trú ' + s(rec.id),
    description: s(rec.tom_tat_noi_dung),
    diaChiXayRa: s(rec.noi_xay_ra),
    sdtNguoiToGiac: s(rec.so_dien_thoai_nguyen_don),
    cmndNguoiToGiac: s(rec.so_cccd_nguyen_don),
    sinhNamNguoiToGiac: s(rec.sinh_nam_nguoi_to_giac),
    benVu: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
    doiTuongCaNhan: s(rec.nghi_van_doi_tuong),
    donViGiaiQuyet: s(rec.don_vi_giai_quyet),
    soQDPhanCongNguonTin: s(rec.quyet_dinh_phan_cong_giai_quyet_nguon_tin),
    ngayQDPhanCongNguonTin: parseLegacyDate(rec.ngay_ra_quyet_dinh_phan_cong_tin_bao),
    canCuKhongKhoiTo: s(rec.can_cu_ra_quyet_dinh_khong_khoi_to),
    canCuTamDinhChi: s(rec.can_cu_tam_dinh_chi_nguon_tin),
    phanLoaiDanSuText: s(rec.phan_loai_dan_su),
    // Field-parity nhóm B — TĐC nguồn tin / phục hồi / chuyển đơn vị
    soQuyetDinhTamDinhChiVV: s(rec.quyet_dinh_tam_dinh_chi_nguon_tin),
    // PR-4: tên cột THẬT trên form (trước đoán sai → di trú rớt ngày TĐC/phục hồi).
    ngayTamDinhChiVV: parseLegacyDate(rec.ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin),
    soQuyetDinhPhucHoiVV: s(rec.phuc_hoi_nguon_tin_toi_pham),
    ngayPhucHoiVV: parseLegacyDate(rec.ngay_phuc_hoi_nguon_tin_toi_pham),
    ngayHetThoiHieuVV: parseLegacyDate(rec.ngay_thang_nam_het_thoi_hieu_vu_viec),
    tienDoKhacPhucTDC: s(rec.tien_do_khac_phuc_tdc),
    chuyenDenDonVi: s(rec.vu_viec_chuyen_don_vi_khac),
    legacyRaw: { ...rec },
  });
}

export function buildCase(rec: LegacyRecord): Record<string, unknown> {
  const own = ownership(rec);
  return clean({
    ...parityColumns(rec, 'case'),
    legacySourceId: legacyKey(rec),
    ...traceFields(rec),
    createdById: own.createdById,
    investigatorId: own.investigatorId,
    assignedTeamId: own.assignedTeamId,
    // Tiêu đề NGẮN GỌN để đọc được trên danh sách; toàn văn giữ ở metadata.description
    // — đúng ô "Mô tả chi tiết" mà form Vụ án đã có sẵn.
    name: caseTitle(rec),
    crime: s(rec['toi-danh-ban-dau']),
    loaiThongTin: s(rec.loai_thong_tin),
    ngayTiepNhan: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin),
    // Giao diện Vụ án đọc các ô này từ metadata (buildCreateCasePayload.ts) nên đổ vào đây
    // là hiện ngay trên form, không phải đổi cấu trúc bảng.
    metadata: clean({
      description: s(rec.tom_tat_noi_dung),
      nguonDon: s(rec.nguon_don),
      nhanXet: s(rec.nhan_xet),
      noiXayRa: s(rec.noi_xay_ra) ?? s(rec.noi_xay_ra_phuong_xa),
      nghiVanDoiTuong: s(rec.nghi_van_doi_tuong),
      biHai: s(rec['dia-chi-bi-hai']),
      // Người/cơ quan cung cấp (đồng thời bị hại) — hệ cũ có, trước đây KHÔNG map vào Case
      // (chỉ Petition/Incident map) → mất hiển thị. Nay đưa vào metadata để surface.
      tenCungCap: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
      sinhNamCungCap: s(rec.sinh_nam_nguoi_to_giac),
      cccdCungCap: s(rec.so_cccd_nguyen_don),
      ngayCapCccd: s(rec.ngay_cap_cccd_nguyen_don),
      noiCapCccd: s(rec.noi_cap_cccd_nguyen_don),
      sdtCungCap: s(rec.so_dien_thoai_nguyen_don),
      diaChiCungCap: s(rec['dia-chi-bi-hai']),
      phuongThucThuDoan: s(rec.phuong_thuc_thu_doan),
      ketQuaXuLyKhac: s(rec.ket_qua_xu_ly_giai_quyet_khac),
      soPhieuChuyen: s(rec.so_phieu_chuyen),
      damageAmount: parseLegacyNumber(rec.so_tien_bi_thiet_hai),
      soLuongBiHai: parseLegacyNumber(rec.so_luong_bi_hai),
      dieuTraVienText: s(rec.dieu_tra_vien),
      sttCu: s(rec.stt_cu),
      tinhTrang: s(rec.tinh_trang),
      phanLoaiToiPhamLinhVuc: s(rec.phan_loai_toi_pham_theo_linh_vuc),
      phanLoaiHoSoNoiBo: s(rec.phan_loai_ho_so_doi_1),
      deXuatXuLy: s(rec.de_xuat),
      yeuCauBoSung: s(rec.yeu_cau_bo_sung),
      // Bổ sung sau rà từng key: các mốc thống kê / thời hiệu / không khởi tố / lịch sử chuyển đơn vị.
      ngayThongKe: parseLegacyDate(rec.ngay_thong_ke),
      ngayKhongKhoiTo: parseLegacyDate(rec.ngay_ra_quyet_dinh_khong_khoi_to),
      soQDKhongKhoiTo: s(rec.quyet_dinh_khong_khoi_to),
      hetThoiHieuTnhs: s(rec.het_thoi_hieu_tnhs),
      ngayHetHanVuAn: parseLegacyDate(rec.ngay_het_han_vu_an),
      thoiGianHetThoiHieuTnhs: s(rec.thoi_gian_het_thoi_hieu_truy_cuu_tnhs),
      dieuTraVienPhuongXa: s(rec.dieu_tra_vien_phuong_xa),
      // Lịch sử chuyển đơn vị (mảng con) — giữ nguyên để cán bộ tra vết đường đi hồ sơ.
      lichSuChuyenDonVi: Array.isArray(rec.lich_su) && rec.lich_su.length ? rec.lich_su : undefined,
    }),
    soQuyetDinhKhoiTo: s(rec.quyet_dinh_khoi_to_vu_an) ?? s(rec.quyet_dinh_khong_khoi_to),
    ngayKhoiTo: parseLegacyDate(rec.ngay_quyet_dinh_khoi_to_vu_an) ?? parseLegacyDate(rec.ngay_ra_quyet_dinh_khoi_to),
    // Bổ sung sau rà từng key (field-map.ts): các mốc tạm đình chỉ / thời hiệu trước bị bỏ.
    soQuyetDinhTamDinhChi: s(rec.quyet_dinh_tam_dinh_chi_vu_an),
    ngayTamDinhChi: parseLegacyDate(rec.ngay_tam_dinh_chi_vu_an),
    ngayHetThoiHieu: parseLegacyDate(rec.ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an),
    soQDNhapVuAn: s(rec.quyet_dinh_nhap_vu_an),
    ngayNhapVuAn: parseLegacyDate(rec.ngay_nhap_vu_an),
    ghiChuNhapHoSo: s(rec.ghi_chu_nhap_ho_so),
    soQDTachVuAn: s(rec.quyet_dinh_tach_vu_an),
    ngayTachVuAn: parseLegacyDate(rec.ngay_tach_ho_so),
    soQDDinhChiVuAn: s(rec.dinh_chi_vu_an),
    ngayDinhChiVuAn: parseLegacyDate(rec.ngay_quyet_dinh_dinh_chi_vu_an),
    chuyenVuAnChoCQK: s(rec.chuyen_vu_an_cho_co_quan_khac),
    soBanAnCoHieuLuc: s(rec.so_ban_an_co_hieu_luc),
    ngayBanAnCoHieuLuc: parseLegacyDate(rec.ngay_ban_an_co_hieu_luc),
    crimeChinhLegacyValue: num(rec.toi_danh_chinh ?? rec.toi_danh_chinh_blhs2015),
    // Field-parity nhóm B — KLĐT, điều tra lại, tách hành vi, căn cứ TĐC/phục hồi, ghi chú tự do
    soKLDT: s(rec.ket_luan_dieu_tra_vu_an),
    ngayKLDT: parseLegacyDate(rec.ngay_ket_luan_dieu_tra),
    soQDDieuTraLai: s(rec.quyet_dinh_dieu_tra_lai),
    ngayQDDieuTraLai: parseLegacyDate(rec.ngay_quyet_dinh_dieu_tra_lai),
    soQDTachHanhVi: s(rec.quyet_dinh_tach_hanh_vi),
    ngayTachHanhVi: parseLegacyDate(rec['ngay-quyet-dinh-tach-hanh-vi']),
    canCuTamDinhChiVuAn: s(rec.can_cu_tam_dinh_chi_vu_an),
    canCuPhucHoiVuAn: s(rec.can_cu_phuc_hoi_dieu_tra_vu_an),
    ghiChuKhac: s(rec.ghi_chu_khac),

    // ── Ô hệ cũ có cột từ 26/08/2026 ────────────────────────────────────────────────
    // Trước đây chúng chỉ nằm ở `metadata` hoặc `legacy_raw`. Nay form Vụ án có ô đúng vị
    // trí hệ cũ, nên phải đổ vào cột — không thì mở hồ sơ di trú ra ô nào cũng trắng.
    phanLoaiNguonTinBanDau: s(rec.phan_loai_nguon_tin_ban_dau),
    ngayXayRa: parseLegacyDate(rec.ngay_xay_ra),
    noiXayRaPhuongXa: s(rec.noi_xay_ra_phuong_xa),
    // Cột `baoCaoBanGiamDoc` là ĐÚNG/SAI suy từ chữ; nội dung chỉ đạo giữ ở cột chữ riêng.
    baoCaoBanGiamDocText: s(rec.truong_hop_bao_cao_ban_giam_doc),

    // Tab "Vụ việc"
    soQDPhanCongNguonTin: s(rec.quyet_dinh_phan_cong_giai_quyet_nguon_tin),
    ngayQDPhanCongNguonTin: parseLegacyDate(rec.ngay_ra_quyet_dinh_phan_cong_tin_bao),
    soQDKhongKhoiTo: s(rec.quyet_dinh_khong_khoi_to),
    ngayQDKhongKhoiTo: parseLegacyDate(rec.ngay_ra_quyet_dinh_khong_khoi_to),
    canCuKhongKhoiTo: s(rec.can_cu_ra_quyet_dinh_khong_khoi_to),
    chuyenVuViecDonViKhac: s(rec.vu_viec_chuyen_don_vi_khac),
    nhapVaoVuViecSo: s(rec.nhap_vao_vu_viec_so),
    phanLoaiDanSu: s(rec.phan_loai_dan_su),

    // Tab "Vụ việc TĐC"
    vuViecTamDungTruoc2015: parseLegacyBool(rec.xac_dinh_vu_viec_tam_dung_giai_quyet),
    soQDTamDinhChiNguonTin: s(rec.quyet_dinh_tam_dinh_chi_nguon_tin),
    ngayQDTamDinhChiNguonTin: parseLegacyDate(rec.ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin),
    canCuTamDinhChiNguonTin: s(rec.can_cu_tam_dinh_chi_nguon_tin),
    ngayHetThoiHieuVuViec: parseLegacyDate(rec.ngay_thang_nam_het_thoi_hieu_vu_viec),
    khacPhucLyDoTDCVuViec: s(rec.khac_phuc_ly_do_tdc),
    tienDoKhacPhucTDCVuViec: s(rec.tien_do_khac_phuc_tdc),
    soPhucHoiNguonTin: s(rec.phuc_hoi_nguon_tin_toi_pham),
    ngayPhucHoiNguonTin: parseLegacyDate(rec.ngay_phuc_hoi_nguon_tin_toi_pham),

    // Tab "Vụ án TĐC" — hai ô khắc phục và cặp phục hồi trước nay chưa builder nào đọc
    tdcKhacPhucBienBan: s(rec.khac_phuc_tdc_vu_an),
    tdcKhacPhucLyDoBienPhap: s(rec.bien_phap_khac_phuc_tdc_vu_an),
    soQuyetDinhPhucHoi: s(rec.quyet_dinh_phuc_hoi_vu_an),
    ngayPhucHoi: parseLegacyDate(rec.ngay_phuc_hoi_dieu_tra_vu_an),

    // Tab "Vật chứng" — ba ô chữ của hệ cũ, khác bảng vật chứng chuẩn hoá
    vatChungMoTa: s(rec.vat_chung),
    lenhNhapKho: s(rec.lenh_nhap_kho),
    noiLuuTruBaoQuan: s(rec.Noi_luu_tru_bao_quan_ke_bien_phong_toa),

    legacyRaw: { ...rec },
  });
}

// ── Tier ③ builders (PR-M3) ───────────────────────────────────────────────
// LƯU Ý độ phủ: tên cột tier-3 hệ cũ CHƯA xác minh trên data thật (chỉ có form hợp nhất
// /doi-1/Them). Vì vậy mỗi builder map các cột BẮT BUỘC/khóa với best-effort + LUÔN giữ
// legacyRaw = toàn bộ record (Codex P1#1 — không bao giờ mất data). Tên cột chính xác +
// đầy đủ field-parity tier-3 sẽ chốt khi chạy trên data thật (PR-M4, information_schema).

// huong-dan-ban-dau → GuidanceRecord. guidedPerson + guidanceContent là NOT NULL → fallback.
function buildGuidance(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: legacyKey(rec),
    guidedPerson: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap) ?? '(di trú)',
    guidedPersonPhone: s(rec.so_dien_thoai_nguyen_don),
    subject: s(rec.loai_thong_tin),
    // GuidanceRecord.date NOT NULL — điền từ nguồn thật thay vì để service đặt mặc định.
    date: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin) ?? parseLegacyDate(rec.ngay_de_xuat),
    guidanceContent: s(rec.tom_tat_noi_dung) ?? '(di trú — không có nội dung)',
    unit: s(rec.don_vi_giai_quyet),
    notes: s(rec.nhan_xet),
    legacyRaw: { ...rec },
  });
}

// trao-doi-chuyen-an → Exchange. Không có cột NOT NULL ngoài default.
function buildExchange(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: legacyKey(rec),
    recordCode: s(rec.so_phieu_chuyen),
    recordType: s(rec.loai_thong_tin),
    senderUnit: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
    receiverUnit: s(rec.don_vi_giai_quyet),
    subject: s(rec.tom_tat_noi_dung),
    legacyRaw: { ...rec },
  });
}

// kien-nghi-vks → Proposal. content NOT NULL → fallback. proposalNumber (@unique) sinh
// deterministic ở commit (DX-LEGACY-<id>) để idempotent.
function buildProposal(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: legacyKey(rec),
    content: s(rec.tom_tat_noi_dung) ?? '(di trú — không có nội dung)',
    unit: s(rec.don_vi_giai_quyet),
    notes: s(rec.nhan_xet),
    sentDate: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin) ?? parseLegacyDate(rec.ngay_de_xuat),
    legacyRaw: { ...rec },
  });
}

// luat-su → Lawyer. fullName NOT NULL → fallback. barNumber (@unique) + caseId (FK required)
// sinh ở commit (host Case).
function buildLawyer(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: legacyKey(rec),
    fullName: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap) ?? 'Luật sư (di trú)',
    phone: s(rec.so_dien_thoai_nguyen_don),
    legacyRaw: { ...rec },
  });
}

// uy-thac-dieu-tra → Case caseType=UY_THAC_DIEU_TRA. Provenance UY_THAC_DIEU_TRA (non-linked,
// thỏa CHECK case_provenance_fk_consistency). Map field UTDT từ buildCase + cột uỷ thác.
function buildUyThacCase(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    ...buildCase(rec),
    caseType: 'UY_THAC_DIEU_TRA',
    donViGiao: s(rec.don_vi_uy_thac),
    soQuyetDinhUyThac: s(rec.so_quyet_dinh_uy_thac),
    ngayTiepNhan: parseLegacyDate(rec.ngay_tiep_nhan_uy_thac),
    thoiHanUyThac: parseLegacyDate(rec.thoi_han_thuc_hien_uy_thac_dieu_tra),
    ketQuaUyThac: s(rec.ket_qua_uy_thac),
    ngayTraKetQua: parseLegacyDate(rec.ngay_tra_ket_qua_uy_thac),
  });
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

// Thống kê mở rộng (case_statistics, 1-1). Trả undefined nếu record không có field thống kê nào
// → KHÔNG tạo row rỗng (Codex P1#7). Cờ boolean dùng parseLegacyBool (nullable — phân biệt thiếu vs false).
export function buildCaseStatistic(rec: LegacyRecord): Record<string, unknown> | undefined {
  // Field đếm là Int? ở DB → round (Float làm Prisma reject cả record). Tiền là Float? → giữ nguyên.
  const int = (v: unknown): number | undefined => {
    const n = parseLegacyNumber(v);
    return n === undefined ? undefined : Math.round(n);
  };
  const stat = clean({
    soLuongBiHai: int(rec.so_luong_bi_hai),
    soNguoiBiThuong: int(rec.so_nguoi_bi_thuong),
    soLuongNguoiChet: int(rec.so_luong_nguoi_chet),
    soTienBiThietHai: parseLegacyNumber(rec.so_tien_bi_thiet_hai),
    soTienThuHoi: parseLegacyNumber(rec.so_tien_thu_hoi),
    soSungThuHoi: int(rec.so_luong_sung_thu_hoi),
    soThuocNoThuHoi: int(rec.so_luong_thuoc_no_thu_hoi),
    soDoiTuong: int(rec.so_doi_tuong), // PR-7 review: tổng số đối tượng (trước rớt vào legacyRaw)
    soDoiTuongDaBat: int(rec.so_doi_tuong_da_bat),
    // PR-4: tên cột THẬT trên form /doi-1/Them (trước đoán sai → di trú rớt data).
    soDoiTuongBiBatVuAnKhac: int(rec.so_doi_tuong_bi_bat_trong_vu_an_khac),
    dieuTraMoRong: int(rec.dieu_tra_mo_rong),
    soBangNhom: int(rec.co_bao_nhieu_bang_nhom), // PR-7 review: số lượng băng nhóm (cùng nguồn với coBangNhom bool)
    soBangNhomBatDuoc: int(rec.bat_duoc_bao_nhieu_bang_nhom),
    coGhiAmGhiHinh: parseLegacyBool(rec.xac_nhan_ghi_am_ghi_hinh),
    laVuAnGhiAmGhiHinh: parseLegacyBool(rec.xac_nhan_neu_la_vu_an_ghi_am_ghi_hinh),
    coVPHC: parseLegacyBool(rec.xac_nhan_vu_viec_vphc),
    coBangNhom: boolFromText(rec.co_bao_nhieu_bang_nhom),
    vuAnDaDuocXetXu: parseLegacyBool(rec.xac_nhan_vu_an_da_duoc_xet_xu),
    ghiAmGhiHinhDaDuocXetXu: parseLegacyBool(rec.ghi_am_ghi_hinh_da_duoc_xet_xu),
    coSuDungKQGhiAmTrongXetXu: parseLegacyBool(rec['vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu']),
    khongGAGHNhungToaYeuCau: parseLegacyBool(rec.vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh),
    soDangKyHoSo: s(rec.so_dang_ky_ho_so),
    ngayDangKyHoSo: parseLegacyDate(rec.ngay_dang_ky_ho_so),
    hoSoLuu: s(rec.ho_so_luu),
    ngayNopLuuHoSo: parseLegacyDate(rec.ngay_nop_luu_ho_so),
    donViBaoQuanHoSo: s(rec.don_vi_bao_quan_ho_so),

    // ── Bổ sung 26/08/2026: khoá hệ cũ có cột sẵn nhưng builder chưa bao giờ đọc ──
    //
    // Bảy mốc thời gian dưới đây phủ 16.9k–17.8k hồ sơ MỖI KHOÁ trên dữ liệu thật, mà tới
    // giờ chỉ nằm trong `legacy_raw`. Hệ quả nhìn thấy được: tab "TK 48 trường" của form
    // mới có đủ ô nhưng ô nào cũng trắng khi mở hồ sơ di trú.
    ngayThongKe: parseLegacyDate(rec.ngay_thong_ke),
    ngayPhanCongGiaiQuyetToGiac: parseLegacyDate(rec.ngay_thoi_diem_phan_cong_giai_quyet_to_giac),
    ngayTiepNhanTin: parseLegacyDate(rec.ngay_tiep_nhan_tin),
    ngayDauThu: parseLegacyDate(rec.ngay_nguoi_pham_toi_dau_thu),
    ngayPhamToiQuaTang: parseLegacyDate(rec.ngay_pham_toi_qua_tang),
    ngayBatKhanCap: parseLegacyDate(rec.ngay_nguoi_pham_toi_bi_bat_khan_cap),
    ngayPhatHienDauHieu: parseLegacyDate(rec.ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi),

    // Cột đã có từ lâu, chỉ thiếu đúng dòng đọc. Trên dữ liệu hiện tại các khoá này rỗng,
    // nhưng hệ cũ VẪN đang nhận nhập liệu — thiếu dòng đọc là hẹn ngày mất dữ liệu.
    suDungVuKhiNong: s(rec.su_dung_vu_khi_nong),
    soDoiTuongVPHC: int(rec.so_doi_tuong_vi_pham_hanh_chinh),
    soNguoiBiPhatTien: int(rec.so_luong_nguoi_bi_phat_tien),
    tongTienPhatHanhChinh: parseLegacyNumber(rec.tong_so_tien_phat_hanh_chinh),
    soDoiTuongSuuTraHiemNghi: int(rec.so_doi_tuong_suu_tra_hiem_nghi),
    tongSoBienBanGhiLoiKhai: int(rec.tong_so_bien_ban_ghi_loi_khai),
    soBienBanGhiLoiKhaiCoGhiAm: int(rec.so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh),
    tongSoBienBanHoiCung: int(rec.tong_so_bien_ban_hoi_cung_bi_can),
    tongSoBienBanHoiCungCoGhiAm: int(rec.tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh),
    soBiCanCoGhiAm: int(rec.so_bi_can_co_ghi_am_ghi_hinh),
    vksYeuCauGhiAm: parseLegacyBool(rec.xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh),
    soBiCanVksYeuCauGhiAm: int(rec.so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh),
  });
  return Object.keys(stat).length > 0 ? stat : undefined;
}

// Tập key cột HỆ CŨ mà mapper ĐỌC vào cột typed (queryable). Dùng cho field-coverage matrix (PR-M4)
// để phân biệt "đã map sang cột" vs "chỉ giữ trong legacyRaw". PHẢI cập nhật khi builder đọc thêm key.
// LƯU Ý (Codex P1#5): đây là registry theo GIẢ ĐỊNH tên cột cũ — coverage chỉ provisional cho tới khi
// chạy trên data thật (PR-M4 real-data: information_schema).
export const MAPPED_LEGACY_KEYS: ReadonlySet<string> = new Set([
  // discriminator + định danh
  'id', 'phan_loai_nguon_tin_ban_dau',
  // Petition / tiếp nhận chung
  'ten_ca_nhan_co_quan_to_chuc_cung_cap', 'so_dien_thoai_nguyen_don', 'sinh_nam_nguoi_to_giac',
  'so_cccd_nguyen_don', 'ngay_cap_cccd_nguyen_don', 'noi_cap_cccd_nguyen_don', 'dia-chi-bi-hai',
  'nghi_van_doi_tuong', 'tom_tat_noi_dung', 'do_vat_tai_lieu_kem_theo', 'nguon_don', 'loai_thong_tin',
  'so_phieu_chuyen', 'ngay_phieu_chuyen', 'ngay_tiep_nhan_nguon_tin', 'toi-danh-ban-dau',
  'toi_danh_chinh_blhs2015', 'noi_xay_ra', 'noi_xay_ra_phuong_xa', 'ngay_xay_ra', 'loai_toi_pham',
  'phuong_thuc_thu_doan', 'ngay_giao_don_vi_giai_quyet', 'lanh_dao_to_tung',
  'ket_qua_xu_ly_giai_quyet_khac', 'ngay_de_xuat', 'ngay_viet_don', 'nhan_xet', 'ghi_chu_trung_don',
  'phan_loai_toi_pham_cong_nghe_cao', 'truong_hop_bao_cao_ban_giam_doc', 'thoi_han_thuc_hien_uy_thac_dieu_tra',
  // Incident / TĐC nguồn tin
  'don_vi_giai_quyet', 'quyet_dinh_phan_cong_giai_quyet_nguon_tin', 'ngay_ra_quyet_dinh_phan_cong_tin_bao',
  'can_cu_ra_quyet_dinh_khong_khoi_to', 'can_cu_tam_dinh_chi_nguon_tin', 'phan_loai_dan_su',
  'quyet_dinh_tam_dinh_chi_nguon_tin', 'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', 'phuc_hoi_nguon_tin_toi_pham',
  'ngay_phuc_hoi_nguon_tin_toi_pham', 'ngay_thang_nam_het_thoi_hieu_vu_viec', 'tien_do_khac_phuc_tdc',
  'vu_viec_chuyen_don_vi_khac',
  // Case / vụ án
  'quyet_dinh_khoi_to_vu_an', 'ngay_quyet_dinh_khoi_to_vu_an', 'quyet_dinh_nhap_vu_an', 'ngay_nhap_vu_an',
  'ghi_chu_nhap_ho_so', 'quyet_dinh_tach_vu_an', 'ngay_tach_ho_so', 'dinh_chi_vu_an',
  'ngay_quyet_dinh_dinh_chi_vu_an', 'chuyen_vu_an_cho_co_quan_khac', 'so_ban_an_co_hieu_luc',
  'ngay_ban_an_co_hieu_luc', 'toi_danh_chinh', 'ket_luan_dieu_tra_vu_an', 'ngay_ket_luan_dieu_tra',
  'quyet_dinh_dieu_tra_lai', 'ngay_quyet_dinh_dieu_tra_lai', 'quyet_dinh_tach_hanh_vi',
  'ngay-quyet-dinh-tach-hanh-vi', 'can_cu_tam_dinh_chi_vu_an', 'can_cu_phuc_hoi_dieu_tra_vu_an', 'ghi_chu_khac',
  // CaseStatistic
  'so_luong_bi_hai', 'so_nguoi_bi_thuong', 'so_luong_nguoi_chet', 'so_tien_bi_thiet_hai', 'so_tien_thu_hoi',
  'so_luong_sung_thu_hoi', 'so_luong_thuoc_no_thu_hoi', 'so_doi_tuong', 'so_doi_tuong_da_bat', 'so_doi_tuong_bi_bat_trong_vu_an_khac',
  'dieu_tra_mo_rong', 'bat_duoc_bao_nhieu_bang_nhom', 'xac_nhan_ghi_am_ghi_hinh', 'xac_nhan_neu_la_vu_an_ghi_am_ghi_hinh', 'xac_nhan_vu_viec_vphc',
  'co_bao_nhieu_bang_nhom', 'xac_nhan_vu_an_da_duoc_xet_xu', 'ghi_am_ghi_hinh_da_duoc_xet_xu',
  'vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu', 'vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh', 'so_dang_ky_ho_so',
  // ── Bổ sung 26/08/2026 ──
  'ngay_thong_ke', 'ngay_thoi_diem_phan_cong_giai_quyet_to_giac', 'ngay_tiep_nhan_tin',
  'ngay_nguoi_pham_toi_dau_thu', 'ngay_pham_toi_qua_tang', 'ngay_nguoi_pham_toi_bi_bat_khan_cap',
  'ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi', 'su_dung_vu_khi_nong',
  'so_doi_tuong_vi_pham_hanh_chinh', 'so_luong_nguoi_bi_phat_tien', 'tong_so_tien_phat_hanh_chinh',
  'so_doi_tuong_suu_tra_hiem_nghi', 'tong_so_bien_ban_ghi_loi_khai',
  'so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh', 'tong_so_bien_ban_hoi_cung_bi_can',
  'tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh', 'so_bi_can_co_ghi_am_ghi_hinh',
  'xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh', 'so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh',
  'vat_chung', 'lenh_nhap_kho', 'Noi_luu_tru_bao_quan_ke_bien_phong_toa',
  'nhap_vao_vu_viec_so', 'xac_dinh_vu_viec_tam_dung_giai_quyet', 'khac_phuc_ly_do_tdc',
  'khac_phuc_tdc_vu_an', 'bien_phap_khac_phuc_tdc_vu_an', 'quyet_dinh_phuc_hoi_vu_an',
  'ngay_phuc_hoi_dieu_tra_vu_an', 'quyet_dinh_khong_khoi_to', 'ngay_ra_quyet_dinh_khong_khoi_to',
  'ngay_dang_ky_ho_so', 'ho_so_luu', 'ngay_nop_luu_ho_so', 'don_vi_bao_quan_ho_so',
  // Ủy thác điều tra
  'don_vi_uy_thac', 'so_quyet_dinh_uy_thac', 'ngay_tiep_nhan_uy_thac', 'ket_qua_uy_thac',
  'ngay_tra_ket_qua_uy_thac',
]);

/**
 * Bảng `TamDinhChi_vu_viec_21` của hệ cũ là danh sách vụ việc ĐÃ TẠM ĐÌNH CHỈ, cấu trúc
 * khác hẳn `ho_so_doi_1` (cột riêng: tam_dinh_chi_so, ly_do, dtv, ksv…). Không có khoá nối
 * tới hồ sơ đã di trú nên coi là vụ việc riêng, trạng thái TAM_DINH_CHI.
 */
function buildTamDinhChiIncident(rec: LegacyRecord): Record<string, unknown> {
  const own = ownership(rec);
  const noiDung = s(rec.noi_dung);
  const dieu = s(rec.dieu);
  // Incident KHÔNG có metadata JSON (chỉ legacyRaw). Các key riêng của bảng TĐC không có
  // ô tương ứng (dtv/ksv/cơ quan/ghi chú) — ghép vào mô tả để cán bộ đọc được, không mất.
  const boSung = [
    dieu ? `Điều luật: ${dieu}` : '',
    s(rec.dtv) ? `Điều tra viên: ${s(rec.dtv)}` : '',
    s(rec.ksv) ? `Kiểm sát viên: ${s(rec.ksv)}` : '',
    s(rec.tam_dinh_chi_co_quan) ? `Cơ quan TĐC: ${s(rec.tam_dinh_chi_co_quan)}` : '',
    s(rec.tiep_nhan_so) ? `Số tiếp nhận: ${s(rec.tiep_nhan_so)}/${s(rec.tiep_nhan_nam)}` : '',
    s(rec.ghi_chu) ? `Ghi chú: ${s(rec.ghi_chu)}` : '',
  ].filter(Boolean).join(' · ');
  const moTa = [noiDung, boSung].filter(Boolean).join('\n\n');
  // Ngày tiếp nhận: ghép tiep_nhan_ngay/thang/nam (nam là 2 chữ số cuối → +2000).
  const tnNam = num(rec.tiep_nhan_nam);
  const tnThang = num(rec.tiep_nhan_thang);
  const tnNgay = num(rec.tiep_nhan_ngay);
  const ngayTiepNhan =
    tnNam && tnThang && tnNgay ? new Date(Date.UTC(tnNam < 100 ? 2000 + tnNam : tnNam, tnThang - 1, tnNgay)) : undefined;
  return clean({
    legacySourceId: legacyKey(rec),
    ...traceFields(rec),
    name: noiDung ? (noiDung.length > 120 ? noiDung.slice(0, 117).trimEnd() + '…' : noiDung) : 'Vụ việc TĐC ' + s(rec.id),
    description: moTa,
    status: 'TAM_DINH_CHI',
    tinhTrangHoSo: dieu ? `Tạm đình chỉ theo Điều ${dieu}` : undefined,
    ngayDeXuat: ngayTiepNhan && !Number.isNaN(ngayTiepNhan.getTime()) ? ngayTiepNhan : undefined,
    soQuyetDinhTamDinhChiVV: s(rec.tam_dinh_chi_so),
    ngayTamDinhChiVV: parseLegacyDate(rec.tam_dinh_chi_time),
    canCuTamDinhChi: s(rec.ly_do),
    createdById: own.createdById,
    investigatorId: own.investigatorId,
    assignedTeamId: own.assignedTeamId,
    // Cột mảng NOT NULL không default.
    lyDoKhongKhoiTo: [],
    lyDoTamDinhChiVuViec: [],
    legacyRaw: { ...rec },
  });
}

export function decomposeLegacyRecord(rec: LegacyRecord): DecomposedEntities {
  const warnings: string[] = [];

  // Nhánh riêng cho bảng tạm đình chỉ — nhận diện theo tên collection, không theo phân loại.
  if (s(rec.__sourceCollection) === 'TamDinhChi_vu_viec_21') {
    return { warnings: [], incident: buildTamDinhChiIncident(rec) };
  }

  const phanLoai = normalizePhanLoai(rec);
  const out: DecomposedEntities = { warnings };

  const hasKhoiTo = !!s(rec.quyet_dinh_khoi_to_vu_an);

  if (phanLoai && PHAN_LOAI_DON.has(phanLoai)) {
    out.petition = buildPetition(rec);
  } else if (phanLoai && PHAN_LOAI_VU_VIEC.has(phanLoai)) {
    out.incident = buildIncident(rec);
  } else if (phanLoai && PHAN_LOAI_VU_AN.has(phanLoai)) {
    out.case = buildCase(rec);
  } else if (phanLoai && PHAN_LOAI_GUIDANCE.has(phanLoai)) {
    // tier-3 standalone — KHÔNG return sớm: nếu record cũng có QĐ khởi tố thì block dưới
    // tạo thêm Case (decompose 1→nhiều), tránh mất dữ liệu khởi tố dạng structured.
    out.guidance = buildGuidance(rec);
  } else if (phanLoai && PHAN_LOAI_EXCHANGE.has(phanLoai)) {
    out.exchange = buildExchange(rec);
  } else if (phanLoai && PHAN_LOAI_PROPOSAL.has(phanLoai)) {
    out.proposal = buildProposal(rec);
  } else if (phanLoai && PHAN_LOAI_UY_THAC.has(phanLoai)) {
    out.case = buildUyThacCase(rec);
    out.caseProvenanceHint = 'UY_THAC_DIEU_TRA';
    // tiếp tục xuống dưới để gắn statistic nếu có
  } else if (phanLoai && PHAN_LOAI_LAWYER.has(phanLoai)) {
    // Lawyer.caseId là FK NOT NULL → cần host Case để gắn. Tạo host Case (TRANSFERRED)
    // bảo toàn toàn bộ record; commit gắn lawyer.caseId = host case id.
    out.lawyer = buildLawyer(rec);
    out.case = buildCase(rec);
    warnings.push(
      `Loại 'luật sư' (record ${s(rec.id)}): tạo Lawyer + host Case để giữ liên kết caseId — xác minh case cha thật ở PR-M4`,
    );
    // tiếp tục xuống dưới để gắn statistic nếu có
  } else if (phanLoai && PHAN_LOAI_TRA_HO_SO.has(phanLoai)) {
    // Module workflow ('Trả hồ sơ') hiện là stub → tạo host Case giữ legacyRaw, defer module.
    out.case = buildCase(rec);
    warnings.push(
      `Loại 'trả hồ sơ' (record ${s(rec.id)}): module workflow chưa xây — lưu tạm vào Case.legacyRaw, defer (PR-M4)`,
    );
  } else if (phanLoai && PHAN_LOAI_CONG_VAN_TDC.has(phanLoai)) {
    // Công văn đôn đốc phục hồi TĐC → cập nhật TĐC. Link record cha cần data thật (M4) →
    // tạm tạo Vụ việc host mang field TĐC phục hồi + legacyRaw.
    out.incident = buildIncident(rec);
    warnings.push(
      `Loại 'công văn phục hồi TĐC' (record ${s(rec.id)}): tạm tạo Vụ việc host mang field phục hồi — link record cha xác minh ở PR-M4`,
    );
  } else {
    warnings.push(`Không nhận diện được phân loại '${phanLoai ?? '(trống)'}' — bỏ qua record ${s(rec.id)}`);
    return out;
  }

  // Decompose 1→nhiều: nếu có QĐ khởi tố mà chưa tạo Case → tạo thêm Case (giai đoạn vụ án).
  if (hasKhoiTo && !out.case) {
    out.case = buildCase(rec);
  }

  // Thống kê mở rộng (case_statistics 1-1) — chỉ khi có dữ liệu thống kê + có Case nhận.
  if (out.case) {
    const stat = buildCaseStatistic(rec);
    if (stat) out.statistic = stat;
  }

  keepSingleLegacyRaw(out);
  return out;
}

/**
 * Một record cũ có thể sinh nhiều thực thể, mà builder nào cũng gắn `legacyRaw: {...rec}`.
 * Bản thô ~6,7KB × 53.820 hồ sơ × 3 thực thể ≈ 1,1GB JSONB thừa. Giữ đúng MỘT bản ở thực thể
 * "chủ" (ưu tiên theo thứ tự dưới); các thực thể còn lại tra ngược qua `legacySourceId`.
 */
function keepSingleLegacyRaw(out: DecomposedEntities): void {
  const owners = [out.case, out.incident, out.petition, out.guidance, out.exchange, out.proposal, out.lawyer];
  let kept = false;
  for (const e of owners) {
    if (!e || !('legacyRaw' in e)) continue;
    if (kept) delete e.legacyRaw;
    else kept = true;
  }
}
