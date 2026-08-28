/**
 * Khoá catalog mang TÊN TRƯỜNG HỆ CŨ — để in được nguyên bộ mẫu Word của hệ cũ.
 *
 * Hệ cũ có 11 mẫu (`/doi_1/file_mau`), mỗi loại hồ sơ một mẫu, và placeholder trong đó chính
 * là tên trường hệ cũ: `{tom_tat_noi_dung}`, `{don_vi_giai_quyet}`, `{nguon_don}`… Mẫu chỉ
 * điền thứ ĐÃ CÓ, trường nào trống thì in ra chỗ trống — nên bấm vào hồ sơ nào cũng ra file.
 *
 * Đó là lý do hệ cũ in được mọi hồ sơ còn hệ mới thì không: mẫu của hệ mới là các quyết định
 * tố tụng, đòi những trường mà CẢ HAI hệ đều chưa từng có (đo 28/08/2026: `so_ket_luan_dieu_tra`
 * 0 bản ghi, `nguoi_quyet_dinh` 0, `don_vi_xu_ly` 0).
 *
 * Bảng ánh xạ `trường cũ → cột typed` KHÔNG viết lại ở đây: dùng `PARITY` của epic field-parity,
 * vốn là nguồn sự thật và đã được cổng kiểm canh. Viết tay lần thứ hai là dựng hệ song song,
 * và hai bảng sẽ lệch nhau ngay lần sửa đầu.
 *
 * Thứ tự đọc: **cột typed trước, bản thô sau**. Hồ sơ tạo mới trên hệ mới không có `legacyRaw`;
 * hồ sơ di trú thì có đủ, nên bản thô là lưới an toàn cho trường chưa kịp thành cột.
 */
import { PARITY, type Entity, type ParityCol } from '../legacy-migration/field-parity.def';
import { parseLegacyDate } from '../legacy-migration/legacy-mapper';
import type { FieldDef } from './field-catalog';
import { KIEU_TRUONG_HE_CU } from './kieu-truong-he-cu.generated';
import { personName, tenNganNhuHeCu } from './ten-nguoi.util';

/** Mốc rỗng của hệ cũ: `0` và `-25200` (GMT+7 lúc 0 giờ) — in ra thành ngày 1970 là sai. */
const MOC_RONG = new Set([0, -25200]);

function chuoi(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Ngày kiểu Việt như mẫu hệ cũ in: `27/08/2026`. */
function ngayViet(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  let d: Date;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number' || /^-?\d+$/.test(String(v))) {
    const n = Number(v);
    if (MOC_RONG.has(n)) return '';
    // Dùng LẠI bộ đọc mốc của di trú, không tự đổi. Bộ ấy đo trên 53.796 hồ sơ: đọc theo UTC
    // hay theo giờ VN đều khớp 0%, chỉ `+50400s` khớp 100% — hệ cũ trừ offset +7 hai lần.
    // Tự nhân 1000 là in ra SỚM MỘT NGÀY trên mọi mốc lấy từ bản thô.
    const dd = parseLegacyDate(n);
    if (!dd) return '';
    d = dd;
  } else {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    d = new Date(String(v));
  }
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function dungSai(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  const s = String(v).trim().toLowerCase();
  if (['0', 'false', 'không', 'khong'].includes(s)) return 'Không';
  return 'Có';
}

/**
 * Giá trị của một trường hệ cũ trên bản ghi hệ mới: cột typed trước, bản thô sau.
 *
 * ── Vì sao kiểu lấy từ bảng của HỆ CŨ, không lấy từ `cot.type` ──
 *
 * `cot.type` nói trường ấy lưu vào CỘT kiểu gì — việc của di trú. Bản in là việc khác: nó phải
 * ra đúng thứ hệ cũ in. Bốn trường tên `ngay_*` (`ngay_phieu_chuyen`, `ngay_tiep_nhan_nguon_tin`,
 * `ngay_viet_don`, `ngay_cap_cccd_nguyen_don`) được hệ cũ khai là `text`, tức cán bộ gõ tay và
 * hệ cũ in NGUYÊN VĂN. Dùng `cot.type` (`DateTime`) để in là chuẩn hoá `09/8/2026` thành
 * `09/08/2026`, và 4.447 hồ sơ có nội dung không phải ngày thì in ra TRỐNG — mất hẳn thông tin
 * trên văn bản gửi đi (đo 28/08/2026 trên 55.067 hồ sơ).
 *
 * Bằng chứng: bản in thật của hồ sơ 86374 tải về ngày 28/08/2026 ghi `Ngày 09/8/2026` và
 * `ghi ngày 15/7/2026` — hai chuỗi không đệm số 0, đúng như trong CSDL hệ cũ.
 *
 * Trường KHÔNG có trong bảng hệ cũ (hệ mới tự thêm) thì vẫn theo `cot.type` — bảng kia không
 * nói gì về chúng, và đoán bừa là chỗ để lệch tiếp.
 */
export function giaTriTheoTenHeCu(record: unknown, cot: ParityCol): string {
  const r = (record ?? {}) as Record<string, unknown>;
  const raw = (r['legacyRaw'] ?? {}) as Record<string, unknown>;
  const tho = raw && typeof raw === 'object' ? raw[cot.field] : undefined;
  const typed = r[cot.col];

  const kieuHeCu = KIEU_TRUONG_HE_CU[cot.field];

  /**
   * LỆCH VAI: hệ cũ khai trường này là chữ, hệ mới lưu nó thành ngày hoặc thành ô đánh dấu.
   *
   * Chuyển kiểu là ĐÚNG cho cột CSDL, nhưng nó bào mất thứ cán bộ đã gõ: `09/8/2026` thành
   * `09/08/2026`, `tháng 5/2026` thành rỗng, một câu giải thích thành `Có`. Bản in phải ra
   * đúng thứ hệ cũ in, nên riêng những ô lệch vai này bản thô đứng TRƯỚC cột typed.
   *
   * Chỉ ở đây thôi. Trường nào hai hệ cùng khai là chữ thì cột typed vẫn đứng trước — nếu
   * không, hồ sơ di trú mà cán bộ đã sửa trên hệ mới sẽ in ra bản gốc chưa sửa.
   *
   * Và ngay trong nhóm lệch vai cũng phải chừa chỗ cho việc SỬA: cán bộ đổi ngày trên hệ mới
   * thì chỉ cột typed đổi, bản thô đứng yên. Lấy bản thô vô điều kiện là in ra ngày CŨ — hỏng
   * im lặng nhất trong cả bản vá, vì văn bản vẫn "có ngày", chỉ là ngày sai. Phân biệt bằng
   * chính giá trị: hai bên cùng chỉ MỘT ngày thì giữ chữ cán bộ gõ; khác ngày nghĩa là vừa có
   * người sửa, lấy cột typed.
   */
  const coTho = tho !== null && tho !== undefined && tho !== '';
  const coTyped = typed !== null && typed !== undefined && typed !== '';
  /**
   * Số điện thoại cũng là một ô lệch vai, chỉ là lệch theo kiểu khác: hai bên cùng khai chữ,
   * nhưng bộ di trú đã DỌN dấu cách và dấu chấm. Cột thành bản chuẩn hoá, bản thô mới là thứ
   * cán bộ gõ — và hệ cũ in đúng thứ cán bộ gõ.
   *
   * Đo trên máy thật 28/08/2026: 82 hồ sơ có số đã dọn khác bản gốc (`0903 958 104` →
   * `0903958104`), và chỗ ấy nằm ngay dòng "Kính gửi" đầu văn bản.
   */
  const soDienThoai = kieuHeCu === 'phone';
  const chiSo = (v: unknown): string => chuoi(v).replace(/\D/g, '');

  const lechVai = !!kieuHeCu && kieuHeCu !== 'date' && (cot.type !== 'String' || soDienThoai);
  const giuBanTho =
    lechVai &&
    coTho &&
    // Ô đánh dấu: bản thô giữ nguyên câu cán bộ ghi, cột typed chỉ còn đúng/sai — bản thô luôn
    // nhiều thông tin hơn nên không có gì để cân nhắc.
    //
    // Ngày và số điện thoại thì phải cân nhắc: cán bộ SỬA trên hệ mới thì chỉ cột đổi, bản thô
    // đứng yên. Cùng một giá trị thì giữ cách gõ cũ; khác giá trị nghĩa là vừa có người sửa.
    (soDienThoai
      ? !coTyped || chiSo(typed) === chiSo(tho)
      : cot.type !== 'DateTime' || !coTyped || ngayViet(typed) === ngayViet(tho));
  const v = giuBanTho ? tho : coTyped ? typed : tho;

  // Trường hệ cũ khai là `date` thật — vẫn đi qua bộ đọc mốc như trước.
  if (kieuHeCu === 'date') return ngayViet(v);
  if (!kieuHeCu && cot.type === 'DateTime') return ngayViet(v);

  // Hồ sơ tạo/sửa trên hệ mới không có bản thô, nên giá trị rơi về cột typed. In một đối tượng
  // ngày ra thành `Fri Aug 28 2026 …` giữa văn bản là thứ phải chặn ở đây.
  if (v instanceof Date) return ngayViet(v);
  if (typeof v === 'boolean') return dungSai(v);
  if (!kieuHeCu && cot.type === 'Boolean') return dungSai(v);

  if (Array.isArray(v)) return v.map(chuoi).filter(Boolean).join(', ').trim();
  return chuoi(v).trim();
}

/**
 * Trường hệ cũ mà thực thể ĐÃ CÓ cột từ trước epic field-parity.
 *
 * `PARITY` chỉ khai những cột epic ấy THÊM MỚI, nên các trường tiếp nhận cơ bản — tên người
 * cung cấp, nội dung, nguồn đơn — không nằm trong đó. Mà đúng chúng mới là thứ mẫu in hệ cũ
 * dùng nhiều nhất (đo 28/08/2026: `tom_tat_noi_dung` 7.990/8.000 hồ sơ, `nguon_don` 7.983).
 *
 * Ánh xạ lấy từ chính bộ di trú (`legacy-mapper.ts`) — nơi quyết định trường cũ đổ vào cột nào.
 */
const CO_SAN_THEO_THUC_THE: Readonly<Record<Entity, readonly ParityCol[]>> = {
  petition: [
    { field: 'tom_tat_noi_dung', col: 'detailContent', type: 'String' },
    { field: 'ten_ca_nhan_co_quan_to_chuc_cung_cap', col: 'senderName', type: 'String' },
    { field: 'so_dien_thoai_nguyen_don', col: 'senderPhone', type: 'String' },
    { field: 'sinh_nam_nguoi_to_giac', col: 'senderBirthYear', type: 'String' },
    { field: 'so_cccd_nguyen_don', col: 'senderIdNumber', type: 'String' },
    { field: 'ngay_cap_cccd_nguyen_don', col: 'senderIdIssueDate', type: 'DateTime' },
    { field: 'noi_cap_cccd_nguyen_don', col: 'senderIdIssuePlace', type: 'String' },
    { field: 'nghi_van_doi_tuong', col: 'suspectedPerson', type: 'String' },
    { field: 'dia-chi-bi-hai', col: 'senderAddress', type: 'String' },
    { field: 'do_vat_tai_lieu_kem_theo', col: 'attachmentsNote', type: 'String' },
    { field: 'nguon_don', col: 'nguonDon', type: 'String' },
    { field: 'loai_thong_tin', col: 'loaiThongTin', type: 'String' },
    { field: 'so_phieu_chuyen', col: 'soPhieuChuyen', type: 'String' },
    { field: 'ngay_phieu_chuyen', col: 'ngayPhieuChuyen', type: 'DateTime' },
    { field: 'ngay_tiep_nhan_nguon_tin', col: 'ngayTiepNhanNguonTin', type: 'DateTime' },
    { field: 'ngay_viet_don', col: 'petitionDate', type: 'DateTime' },
    { field: 'nhan_xet', col: 'nhanThay', type: 'String' },
    { field: 'ghi_chu_trung_don', col: 'raSoatTrung', type: 'String' },
    { field: 'noi_xay_ra', col: 'noiXayRa', type: 'String' },
    { field: 'ket_qua_xu_ly_giai_quyet_khac', col: 'ketQuaXuLyKhac', type: 'String' },
    { field: 'lanh_dao_to_tung', col: 'lanhDaoToTung', type: 'String' },
    { field: 'thoi_han_thuc_hien_uy_thac_dieu_tra', col: 'thoiHanUTDT', type: 'DateTime' },
  ],
  incident: [
    { field: 'tom_tat_noi_dung', col: 'description', type: 'String' },
    { field: 'ten_ca_nhan_co_quan_to_chuc_cung_cap', col: 'benVu', type: 'String' },
    { field: 'nguon_don', col: 'chuyenTuDonVi', type: 'String' },
    { field: 'nghi_van_doi_tuong', col: 'doiTuongCaNhan', type: 'String' },
    { field: 'don_vi_giai_quyet', col: 'donViGiaiQuyet', type: 'String' },
    { field: 'ket_qua_xu_ly_giai_quyet_khac', col: 'ketQuaXuLy', type: 'String' },
    { field: 'so_dien_thoai_nguyen_don', col: 'sdtNguoiToGiac', type: 'String' },
    { field: 'ngay_de_xuat', col: 'ngayDeXuat', type: 'DateTime' },
  ],
  case: [
    { field: 'so_dien_thoai_nguyen_don', col: 'sdtCungCap', type: 'String' },
    // Mẫu `an_tra_bo_sung_mau.docx` in `${toi_danh}` và `${don_vi}`. Không khai thì hai ô ấy
    // in ra trống dù Vụ án đã có sẵn `crime` và `unit` — đúng thứ mẫu cần.
    { field: 'toi_danh', col: 'crime', type: 'String' },
    { field: 'don_vi', col: 'unit', type: 'String' },
    { field: 'dieu_tra_vien_ten', col: 'dieuTraVien', type: 'String' },
  ],
};

/**
 * Khoá catalog cho mọi trường hệ cũ của một thực thể.
 *
 * GIỮ CẢ tên có gạch nối (`dia-chi-bi-hai`, `toi-danh-ban-dau`). Bản đầu bỏ chúng đi vì tưởng
 * mẫu không dùng — nhưng `don_thu_mau.docx` in địa chỉ bị hại bằng đúng `{dia-chi-bi-hai}`,
 * nên bỏ là mẫu ấy in ra nguyên chữ `{dia-chi-bi-hai}` giữa văn bản gửi đi.
 */
/**
 * Cột mà bản in dùng cho mỗi trường hệ cũ của một thực thể.
 *
 * Tách ra khỏi `khoaTheoTenHeCu` để cổng kiểm soi được LỰA CHỌN CỘT, chứ không chỉ soi giá trị
 * trả về. Cổng đầu tiên chỉ gọi `resolve` rồi đoán kiểu cột qua chuỗi `Có`/`Không` — nó không
 * bắt được lỗi gieo vào, vì `resolve` đọc tên CỘT còn ca kiểm lại truyền tên TRƯỜNG. Một cổng
 * không bắt được lỗi còn tệ hơn không có cổng.
 *
 * Một trường hệ cũ có thể đổ vào HAI cột — cố ý, để vừa lọc được vừa giữ được chữ.
 * `truong_hop_bao_cao_ban_giam_doc` đi vào `baoCaoBanGiamDoc` (đúng/sai) VÀ
 * `baoCaoBanGiamDocText` (chữ). Bản in phải lấy cột CHỮ: hệ cũ in nguyên câu cán bộ ghi. Lấy
 * mục đầu tiên gặp thì ở Vụ việc và Vụ án cột đúng/sai đứng trước, nên hồ sơ tạo trên hệ mới in
 * ra `Có` thay vì câu ấy — cán bộ đọc bản in không biết nội dung báo cáo là gì.
 */
export function cotInTheoTruongHeCu(entity: Entity): Map<string, ParityCol> {
  // Bảng "đã có cột" đứng TRƯỚC: nó ánh xạ đúng cột mà bộ di trú dùng, còn `PARITY` có thể
  // khai một cột khác cho cùng tên trường ở thực thể khác.
  const ra = new Map<string, ParityCol>();
  for (const cot of [...CO_SAN_THEO_THUC_THE[entity], ...PARITY[entity]]) {
    const dang = ra.get(cot.field);
    if (!dang || (dang.type !== 'String' && cot.type === 'String')) ra.set(cot.field, cot);
  }
  return ra;
}

export function khoaTheoTenHeCu(entity: Entity): FieldDef[] {
  const ra: FieldDef[] = [];
  const daCo = new Set<string>();
  const nguon = [...CO_SAN_THEO_THUC_THE[entity], ...PARITY[entity]];
  const uuTienChu = cotInTheoTruongHeCu(entity);

  for (const goc of nguon) {
    if (daCo.has(goc.field)) continue;
    daCo.add(goc.field);
    const cot = uuTienChu.get(goc.field) ?? goc;
    ra.push({
      key: cot.field,
      label: cot.field,
      group: 'Trường hệ cũ',
      resolve: (record: unknown) => giaTriTheoTenHeCu(record, cot),
    });
  }
  return ra;
}

/**
 * Số hồ sơ đúng như hệ cũ IN ra: giá trị TRẦN của trường `stt`, không ghép năm.
 *
 * Bản in thật tải về ngày 28/08/2026 ghi `Số: 9842/ĐX-PC02-Đ1` (hồ sơ 85651, `stt = 9842`) và
 * `Số: 11141/ĐX-PC02-Đ1` (hồ sơ 86950, `stt = 11141`). Mã in gốc chỉ đổ thẳng `$info['stt']`.
 *
 * Bản trước in `26-9842` vì lấy theo cách hệ cũ hiện trên MÀN HÌNH danh sách. Hai bề mặt khác
 * nhau, và bề mặt sai ở đây là số hiệu văn bản gửi đi.
 *
 * Hồ sơ tạo mới trên hệ mới không có bản thô; lúc ấy cắt phần năm khỏi mã `2026-11141` để ra
 * cùng một con số, chứ không in cả mã.
 */
function soHoSoNhuHeCu(record: unknown): string {
  const r = (record ?? {}) as Record<string, unknown>;
  const raw = (r['legacyRaw'] ?? {}) as Record<string, unknown>;
  const tho = chuoi(raw['stt']);
  if (tho) return tho;
  const ma = chuoi(r['stt'] ?? r['code'] ?? r['caseCode'] ?? r['soHoSoCu']);
  const m = /^(\d{4})-(.+)$/.exec(ma);
  return m ? m[2] : ma;
}

/**
 * Ba ô `ngay` / `thang` / `nam` ở dòng "…, ngày … tháng … năm …" đầu văn bản.
 *
 * Hệ cũ KHÔNG tính chúng từ ngày ký — chúng là ba TRƯỜNG của chính hồ sơ (`$info['ngay']`,
 * `$info['thang']`, `$info['nam']`), và mã in đổ thẳng ra. Hồ sơ 85651 mở đầu bằng
 * `ngày 21 tháng 7 năm 2026` đúng bằng ba trường ấy.
 *
 * Luật đệm số 0 của hệ cũ KHÔNG đối xứng: `xuatfile.php` chỉ đệm cho `ngay` và `ngay_thang`,
 * còn `thang` thì không. Hồ sơ 86374 (`ngay = 9`, `thang = 8`) in ra `ngày 09 tháng 8 năm 2026`
 * — chứng minh cả hai vế. Đo 28/08/2026: 42.178/55.067 hồ sơ có tháng một chữ số, nên đệm nhầm
 * là lệch ở phần lớn bản in.
 *
 * Hồ sơ tạo mới trên hệ mới không có bản thô; lúc ấy rơi về ngày ký như trước, chứ không in
 * trống mất cả dòng.
 */
function oDauVanBan(record: unknown, khoa: 'ngay' | 'thang' | 'nam'): string {
  const r = (record ?? {}) as Record<string, unknown>;
  const raw = (r['legacyRaw'] ?? {}) as Record<string, unknown>;
  const coRaw = raw && typeof raw === 'object';

  /**
   * Quyết định MỘT LẦN cho cả ba ô, không quyết từng ô.
   *
   * Hồ sơ di trú thiếu riêng một ô (vd `thang` rỗng) mà quyết từng ô thì `ngay` lấy từ hồ sơ còn
   * `thang` tự lấy từ ngày ký — ra một ngày tháng KHÔNG tồn tại ở đâu cả, và không ai nhận ra vì
   * dòng ấy vẫn đọc trôi chảy. Hệ cũ đổ thẳng `$info[...]`: rỗng thì in rỗng.
   */
  const laHoSoDiTru =
    coRaw && (['ngay', 'thang', 'nam'] as const).some((k) => raw[k] !== null && raw[k] !== undefined && raw[k] !== '');

  if (laHoSoDiTru) {
    const tho = raw[khoa];
    if (tho === null || tho === undefined || tho === '') return '';
    const s = chuoi(tho).trim();
    // Chỉ `ngay` được đệm, và chỉ khi nó là số nhỏ hơn 10 — đúng điều kiện `$value < 10`.
    if (khoa === 'ngay' && /^\d$/.test(s)) return `0${s}`;
    return s;
  }

  const d = ngayKy(record);
  if (khoa === 'nam') return String(d.getFullYear());
  if (khoa === 'thang') return String(d.getMonth() + 1);
  return String(d.getDate()).padStart(2, '0');
}

/** Ngày dùng cho dòng "ngày … tháng … năm …" khi hồ sơ không mang bản thô của hệ cũ. */
function ngayKy(record: unknown): Date {
  const r = (record ?? {}) as Record<string, unknown>;
  for (const k of ['ngayDeXuat', 'receivedDate', 'ngayTiepNhanNguonTin']) {
    const v = r[k];
    if (v) {
      const d = v instanceof Date ? v : new Date(String(v));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

/**
 * Biến mẫu hệ cũ dùng mà KHÔNG nằm trong bảng parity.
 *
 * Khai riêng kèm lý do thay vì im lặng bỏ qua: một placeholder không tra được sẽ in ra
 * nguyên `{ten_bien}` trên văn bản gửi đi.
 */
export const KHOA_HE_CU_NGOAI_PARITY: FieldDef[] = [
  {
    // Mã hồ sơ. Ba thực thể ba tên cột khác nhau nên dò lần lượt.
    key: 'stt',
    label: 'Mã hồ sơ',
    group: 'Trường hệ cũ',
    // Vụ án di trú có thể chưa được cấp `caseCode`; khi ấy mã nằm ở `soHoSoCu` hoặc bản thô.
    // Mọi mẫu hệ cũ đều in `${stt}`, nên trả rỗng là văn bản mất số hồ sơ.
    resolve: (r) => soHoSoNhuHeCu(r),
  },
  {
    key: 'ngay',
    label: 'Ngày (đầu văn bản)',
    group: 'Trường hệ cũ',
    resolve: (r) => oDauVanBan(r, 'ngay'),
  },
  {
    key: 'thang',
    label: 'Tháng (đầu văn bản)',
    group: 'Trường hệ cũ',
    resolve: (r) => oDauVanBan(r, 'thang'),
  },
  {
    key: 'nam',
    label: 'Năm (đầu văn bản)',
    group: 'Trường hệ cũ',
    resolve: (r) => oDauVanBan(r, 'nam'),
  },
  {
    // Hệ cũ tra `nguoi_them` sang bảng `thanh_vien` rồi in tên — nên hai biến này KHÔNG có
    // trong bản thô, mà mẫu vẫn in ra được. Hệ mới lấy từ quan hệ người dùng.
    key: 'nguoi_nhan',
    label: 'Cán bộ nhập',
    group: 'Trường hệ cũ',
    resolve: (r) => personName(r?.enteredBy ?? r?.canBoNhap ?? r?.createdBy),
  },
  {
    // Đứng ở dòng "Lưu:" cuối văn bản — hệ cũ in dạng VIẾT TẮT (`H.Duy`), không in tên đầy đủ.
    key: 'ten_ngan',
    label: 'Tên viết tắt cán bộ nhập',
    group: 'Trường hệ cũ',
    resolve: (r) => tenNganNhuHeCu(r?.enteredBy ?? r?.canBoNhap ?? r?.createdBy),
  },
];
