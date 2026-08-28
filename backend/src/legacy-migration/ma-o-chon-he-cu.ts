/**
 * Giải mã những ô `<select>` của hệ cũ mà ta đã chép sang thành ô chữ tự do.
 *
 * ── Chuyện gì đã xảy ra ──
 *
 * Hệ cũ lưu ô chọn bằng SỐ; chữ chỉ tra ra lúc hiện (`$_LANG['tinh_trang_vu_an'][$ma]`). Đợt
 * field-parity khai những trường ấy là `type: 'String'` và chép nguyên giá trị, nên cột chữ
 * của ta chứa mã số, và form vẽ nó bằng ô gõ tự do. Kết quả: vụ án `2026-11139` hiện `-1` ở
 * ô "Tình trạng hồ sơ" — anh phát hiện ngày 28/08/2026.
 *
 * Cổng parity lúc ấy đo "có bao nhiêu hồ sơ CÓ giá trị", không hỏi giá trị ấy LÀ GÌ. Một cột
 * chứa toàn mã canh "chưa chọn" trông y hệt một cột đầy dữ liệu, nếu chỉ đếm.
 *
 * ── Đo trên dữ liệu thật (28/08/2026) ──
 *
 * Máy chạy thật: `-1` ở 15.176 đơn thư · 1.273 vụ việc · 1.873 vụ án.
 * Bản sao gốc `pc02_legacy_backup.legacy_ho_so_doi_1`: `tinh_trang` chỉ có KHÔNG CÓ (36.883)
 * hoặc `-1` (18.184) — không một bản ghi nào mang mã thật. Ta chép ĐÚNG, chỉ hiện SAI.
 *
 * Vẫn dựng bảng mã đầy đủ chứ không chỉ xoá `-1`: đợt đồng bộ sau có thể kéo về bản ghi mang
 * mã thật, và lúc ấy phải ra chữ chứ không phải một con số khác.
 *
 * ── Nguồn bảng mã ──
 *
 * Lấy từ chính ô lọc của hệ cũ ngày 28/08/2026 (đăng nhập CHỈ ĐỌC, đọc `<option>` trong HTML
 * của `/VuAn` và `/VuViec`). Bảng `$_LANG` nằm ở tệp ngôn ngữ không có trong bản sao mã nguồn,
 * nên đây là đường duy nhất lấy được nguyên văn.
 *
 * `-1` trong Ô LỌC nghĩa là "Tất cả"; `-1` trên BẢN GHI nghĩa là "Chưa chọn"
 * (`_PC02/Modules/VuAn/act/insert.php:90` đặt mặc định `-1` lúc tạo, và
 * `_PC02/templates/HoSo_list.tpl:427` khai `tinhTrangMap[-1]="Chưa chọn"`). Hai nghĩa cho cùng
 * một số ở hai chỗ khác nhau — ở đây ta luôn đọc theo nghĩa BẢN GHI.
 */

export type ThucTheHoSo = 'DON_THU' | 'VU_VIEC' | 'VU_AN';

/**
 * Mã canh "người dùng chưa chọn gì" — hiện ra phải là Ô TRỐNG.
 *
 * CHỈ có `-1`. `-2` là một lựa chọn thật ("Chưa rõ") mà cán bộ chủ động chọn; gộp nó vào đây
 * là xoá mất một thông tin đã được nhập.
 */
export const MA_CHUA_CHON: ReadonlySet<string> = new Set(['-1']);

/** Vụ án — 13 lựa chọn thật, đọc từ ô lọc `/VuAn` (bỏ `-1` "Tất cả" của bộ lọc). */
const TINH_TRANG_VU_AN: Readonly<Record<string, string>> = {
  '-2': 'Chưa rõ',
  '0': 'Vụ án đang điều tra',
  '2': 'Đã kết luận điều tra',
  '3': 'Điều tra bổ sung',
  '4': 'Điều tra lại',
  '5': 'Vụ án Tạm đình chỉ',
  '6': 'Vụ án TĐC hết thời hiệu',
  '7': 'Vụ án TĐC HTH đã đình chỉ',
  '8': 'Đình chỉ vụ án',
  '9': 'Vụ án đã chuyển đơn vị khác',
  '10': 'Đã nhập vào vụ án khác',
  '11': 'Vụ án phục hồi điều tra',
  '12': 'Vụ án đã được tách',
};

/** Vụ việc — 15 lựa chọn thật, đọc từ ô lọc `/VuViec`. Mã trùng số nhưng KHÁC nghĩa vụ án. */
const TINH_TRANG_VU_VIEC: Readonly<Record<string, string>> = {
  '-2': 'Chưa rõ',
  '0': 'Vụ việc đang xác minh',
  '1': 'Vụ việc đã lên phân công',
  '2': 'Vụ việc không khởi tố',
  '3': 'Vụ việc Tạm đình chỉ',
  '4': 'Vụ việc TĐC hết thời hiệu',
  '5': 'Vụ việc TĐC HTH không khởi tố',
  '6': 'Vụ việc đã chuyển đơn vị khác',
  '7': 'Đã nhập vào vụ việc khác',
  '8': 'Phân loại dân sự',
  '9': 'Ủy thác điều tra',
  '10': 'Luật sư',
  '11': 'Vụ việc chuyển XPHC',
  '12': 'Vụ việc phục hồi nguồn tin TP',
  '13': 'Phân loại khác',
};

/**
 * Đơn thư dùng chung bảng của vụ việc.
 *
 * Hệ cũ không có màn lọc riêng cho đơn thư ở trường này, mà đơn thư là giai đoạn trước vụ
 * việc trong cùng một luồng `ho_so_doi_1`. Dùng chung là diễn giải sát nhất; và trên dữ liệu
 * thật thì 15.176 đơn thư đều mang `-1`, nên lựa chọn này chưa đụng tới bản ghi nào.
 */
const TINH_TRANG_DON_THU = TINH_TRANG_VU_VIEC;

export const BANG_TINH_TRANG: Readonly<Record<ThucTheHoSo, Readonly<Record<string, string>>>> = {
  VU_AN: TINH_TRANG_VU_AN,
  VU_VIEC: TINH_TRANG_VU_VIEC,
  DON_THU: TINH_TRANG_DON_THU,
};

function chuoi(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Đổi giá trị thô của ô "Tình trạng hồ sơ" thành thứ hiện được cho người đọc.
 *
 * Bốn nhánh, theo đúng thứ tự:
 *   rỗng            → rỗng
 *   mã canh (`-1`)  → rỗng, đúng như hệ cũ hiện "Chưa chọn"
 *   mã tra được     → chữ
 *   còn lại         → GIỮ NGUYÊN
 *
 * Nhánh cuối là chỗ quan trọng nhất. Nó bảo toàn 118 vụ việc đang mang chữ thật ("Tạm đình
 * chỉ theo Điều 134"), và bảo toàn cả mã lạ chưa biết — bịa chữ hay xoá đi đều tệ hơn để
 * người ta nhìn thấy thứ đang có. Nhánh này cũng làm hàm chạy lại được: giải mã một giá trị
 * đã giải mã thì ra chính nó.
 */
export function giaiMaTinhTrang(thucThe: ThucTheHoSo, tho: unknown): string {
  const v = chuoi(tho);
  if (!v) return '';
  if (MA_CHUA_CHON.has(v)) return '';
  return BANG_TINH_TRANG[thucThe][v] ?? v;
}

/**
 * Đổi "Tội danh ban đầu" từ khoá số sang tên tội danh.
 *
 * `toi-danh-ban-dau` là KHOÁ tới bảng tội danh hệ cũ, không phải chữ — thấy ở
 * `_PC02/Modules/_tools/act/test.php:50` (`mdb_get_ids("ho_so",…,'toi-danh-ban-dau')`).
 * Trong 55.067 bản ghi gốc thì 54.990 đã là chữ, còn 76 vẫn là số. Bảng tra dựng từ
 * `pc02_legacy_backup.legacy_toidanh` (`legacy_id` → `doc->>'ten'`).
 *
 * Không tra được thì giữ nguyên số: một khoá lạ vẫn là đầu mối tra tay được, còn ô trống thì
 * mất hẳn.
 */
export function giaiMaToiDanhBanDau(tho: unknown, tra: ReadonlyMap<string, string>): string {
  const v = chuoi(tho);
  if (!v) return '';
  if (!/^\d+$/.test(v)) return v;
  return tra.get(v) ?? v;
}

/**
 * Phân loại hồ sơ nội bộ (`phan_loai_ho_so_doi_1`).
 *
 * Ô lọc hệ cũ `/doi-1/da-phan-loai` khai 11 lựa chọn bằng CHỮ (`don_thu`,
 * `vu_viec_da_phan_loai`…), nhưng `_PC02/Modules/doi_1/act/update.php:78` lại ghi
 * `intval(REQUEST(...,-1))` — nên bản ghi chưa phân loại mang `-1`.
 *
 * Đo 28/08/2026: cột `phanLoaiHoSoNoiBo` trên máy thật có ĐÚNG một giá trị là `-1`
 * (4.790 đơn thư · 184 vụ việc · 1.313 vụ án). Bảng chữ vẫn khai đủ để đợt đồng bộ sau
 * kéo về mã thật thì hiện ra chữ.
 */
const PHAN_LOAI_HO_SO: Readonly<Record<string, string>> = {
  don_thu: 'Đơn thư đã phân loại',
  vu_viec_da_phan_loai: 'Vụ việc đã phân loại',
  vu_an_da_phan_loai: 'Vụ án đã phân loại',
  tra_ho_so: 'Trả hồ sơ',
  huong_dan: 'Hướng dẫn',
  trao_doi_chuyen_an: 'Trao đổi chuyên án',
  luat_su: 'Luật sư',
  uy_thac_dieu_tra: 'Ủy thác điều tra',
  vu_viec_phuong_xa: 'Vụ việc phường/xã',
  vu_an_phuong_xa: 'Vụ án phường/xã',
  kien_nghi_vks: 'Kiến nghị VKS',
};

export function giaiMaPhanLoaiHoSo(tho: unknown): string {
  const v = chuoi(tho);
  if (!v) return '';
  if (MA_CHUA_CHON.has(v)) return '';
  return PHAN_LOAI_HO_SO[v] ?? v;
}

/** Loại ô chọn khai được trên spec parity. */
export type LoaiOChon = 'tinhTrang' | 'phanLoaiHoSo';

/** Thực thể của spec parity → thực thể của bảng mã. Một chỗ đổi, khỏi rải `?:` khắp nơi. */
export const THUC_THE_THEO_PARITY: Readonly<Record<string, ThucTheHoSo>> = {
  petition: 'DON_THU',
  incident: 'VU_VIEC',
  case: 'VU_AN',
};

/**
 * Cửa duy nhất bộ nạp gọi. Gom vào một hàm để mọi đường nhập — di trú mới, bù cột, đồng bộ
 * định kỳ — không thể quên mất một loại.
 */
export function giaiMaOChon(loai: LoaiOChon, thucThe: ThucTheHoSo, tho: unknown): string {
  return loai === 'tinhTrang' ? giaiMaTinhTrang(thucThe, tho) : giaiMaPhanLoaiHoSo(tho);
}
