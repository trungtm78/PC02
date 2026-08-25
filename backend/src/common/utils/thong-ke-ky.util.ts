/**
 * Kỳ thống kê — giải cấu hình của admin thành một khoảng ngày cụ thể.
 *
 * ĐÂY LÀ NƠI DUY NHẤT tính mốc kỳ trong toàn hệ thống. Thẻ số trên ba trang danh sách, chính
 * danh sách, và badge trên thanh menu đều gọi vào đây — nên nếu để mỗi chỗ tự tính thì ba chỗ
 * sẽ lệch nhau ngay lần đầu ai đó sửa một chỗ mà quên hai chỗ kia.
 *
 * Hàm THUẦN, nhận `now` từ ngoài để ca kiểm cố định được thời điểm.
 */

/** WIRE FORMAT — giá trị lưu trong cột `value` của `system_settings`. Không đổi tên. */
export const KY_THONG_KE = {
  THANG_HIEN_TAI: 'THANG_HIEN_TAI',
  QUY_HIEN_TAI: 'QUY_HIEN_TAI',
  NAM_HIEN_TAI: 'NAM_HIEN_TAI',
  KHOANG_TUY_CHON: 'KHOANG_TUY_CHON',
  TAT_CA: 'TAT_CA',
} as const;
export type KyThongKe = (typeof KY_THONG_KE)[keyof typeof KY_THONG_KE];

/** WIRE FORMAT — như trên. */
export const TRUONG_NGAY_THONG_KE = {
  NGAY_TIEP_NHAN: 'NGAY_TIEP_NHAN',
  NGAY_TAO: 'NGAY_TAO',
} as const;
export type TruongNgayThongKe =
  (typeof TRUONG_NGAY_THONG_KE)[keyof typeof TRUONG_NGAY_THONG_KE];

export const MAC_DINH_KY: KyThongKe = KY_THONG_KE.THANG_HIEN_TAI;
export const MAC_DINH_TRUONG: TruongNgayThongKe = TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN;

export interface CauHinhKyThongKe {
  ky?: string | null;
  truong?: string | null;
  tuNgay?: string | null;
  denNgay?: string | null;
}

export interface KyDaGiai {
  ky: KyThongKe;
  truong: TruongNgayThongKe;
  /** `YYYY-MM-DD`, hoặc `null` khi kỳ là TAT_CA — nghĩa là KHÔNG lọc theo ngày. */
  tuNgay: string | null;
  denNgay: string | null;
}

/**
 * `YYYY-MM-DD` theo GIỜ ĐỊA PHƯƠNG.
 *
 * Không dùng `toISOString()`: máy chủ chạy múi giờ +7, nên 01/08 lúc 00:00 giờ Việt Nam ra
 * "2026-07-31" — kỳ hụt mất ngày đầu và dôi ra ngày cuối. Hồ sơ tiếp nhận đúng ngày mùng 1
 * sẽ biến mất khỏi báo cáo tháng, và không có gì báo.
 */
function ngayISO(d: Date): string {
  const thang = String(d.getMonth() + 1).padStart(2, '0');
  const ngay = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${thang}-${ngay}`;
}

/** Ngày 0 của tháng kế = ngày cuối tháng này. Tự đúng cả tháng 2 năm nhuận. */
function cuoiThang(nam: number, thangIdx: number): Date {
  return new Date(nam, thangIdx + 1, 0);
}

function laKyHopLe(v: unknown): v is KyThongKe {
  return typeof v === 'string' && Object.values(KY_THONG_KE).includes(v as KyThongKe);
}

function laTruongHopLe(v: unknown): v is TruongNgayThongKe {
  return (
    typeof v === 'string' &&
    Object.values(TRUONG_NGAY_THONG_KE).includes(v as TruongNgayThongKe)
  );
}

const DANG_NGAY = /^\d{4}-\d{2}-\d{2}$/;

export function giaiKyThongKe(cauHinh: CauHinhKyThongKe, now: Date): KyDaGiai {
  // Giá trị lạ (khoá bị sửa tay trong DB, hoặc bản cũ còn sót) → rơi về mặc định thay vì để
  // một chuỗi vô nghĩa chảy xuống Prisma.
  const truong = laTruongHopLe(cauHinh.truong) ? cauHinh.truong : MAC_DINH_TRUONG;
  let ky = laKyHopLe(cauHinh.ky) ? cauHinh.ky : MAC_DINH_KY;

  if (ky === KY_THONG_KE.KHOANG_TUY_CHON) {
    const tu = cauHinh.tuNgay ?? '';
    const den = cauHinh.denNgay ?? '';
    if (DANG_NGAY.test(tu) && DANG_NGAY.test(den)) {
      return { ky, truong, tuNgay: tu, denNgay: den };
    }
    // Admin chọn "khoảng tuỳ chọn" rồi quên nhập ngày. Ném lỗi ở đây là cả thanh menu và ba
    // trang danh sách cùng vỡ vì một ô cấu hình bỏ trống.
    ky = MAC_DINH_KY;
  }

  if (ky === KY_THONG_KE.TAT_CA) {
    // `null` tường minh, KHÔNG phải chuỗi rỗng: chuỗi rỗng đi vào `new Date('')` ra
    // `Invalid Date`, Prisma nhận và truy vấn trả 0 dòng — mọi con số về 0 mà không có lỗi.
    return { ky, truong, tuNgay: null, denNgay: null };
  }

  const nam = now.getFullYear();

  if (ky === KY_THONG_KE.NAM_HIEN_TAI) {
    return { ky, truong, tuNgay: ngayISO(new Date(nam, 0, 1)), denNgay: ngayISO(new Date(nam, 11, 31)) };
  }

  if (ky === KY_THONG_KE.QUY_HIEN_TAI) {
    const quyDau = Math.floor(now.getMonth() / 3) * 3;
    return {
      ky,
      truong,
      tuNgay: ngayISO(new Date(nam, quyDau, 1)),
      denNgay: ngayISO(cuoiThang(nam, quyDau + 2)),
    };
  }

  const thang = now.getMonth();
  return {
    ky: KY_THONG_KE.THANG_HIEN_TAI,
    truong,
    tuNgay: ngayISO(new Date(nam, thang, 1)),
    denNgay: ngayISO(cuoiThang(nam, thang)),
  };
}

/**
 * Áp kỳ thống kê vào điều kiện truy vấn.
 *
 * SÁU CHỖ GỌI VÀO ĐÂY: danh sách và thống kê của Đơn thư, Vụ việc, Vụ án. Để mỗi chỗ tự dựng
 * điều kiện ngày là sáu chỗ để lệch nhau — và lệch kiểu này thì thẻ số nói một con số còn
 * danh sách ngay dưới nói con số khác, đúng thứ anh chốt là không được xảy ra.
 *
 * Thứ tự ưu tiên: ngày người dùng tự đặt THẮNG mốc của kỳ, từng đầu một. Người dùng chỉ đặt
 * "từ ngày" thì đầu "đến ngày" vẫn theo kỳ — không im lặng bỏ luôn cả kỳ.
 *
 * Cột lọc do `ky.truong` quyết: chọn "ngày tạo" thì lọc `createdAt` và KHÔNG đụng cột tiếp
 * nhận. Lọc cả hai cột là giao của hai điều kiện, cho ra số nhỏ hơn cả hai mà không ai hiểu.
 */
export function apDungKyVaoWhere(
  where: Record<string, unknown>,
  ky: Pick<KyDaGiai, 'truong' | 'tuNgay' | 'denNgay'>,
  nguoiDungTuNgay: string | undefined | null,
  nguoiDungDenNgay: string | undefined | null,
  cotTiepNhan: string,
): void {
  const tu = nguoiDungTuNgay || ky.tuNgay;
  const den = nguoiDungDenNgay || ky.denNgay;
  if (!tu && !den) return;

  const cot = ky.truong === TRUONG_NGAY_THONG_KE.NGAY_TAO ? 'createdAt' : cotTiepNhan;
  const dieuKien: { gte?: Date; lte?: Date } = {};
  if (tu) dieuKien.gte = new Date(`${tu}T00:00:00`);
  // CUỐI NGÀY, không phải nửa đêm. `new Date('2026-08-31')` là 00:00 — mọi hồ sơ tiếp nhận
  // TRONG ngày 31 đều lớn hơn mốc ấy và rơi khỏi kỳ. Thống kê tháng mất trọn ngày cuối
  // tháng, và mất im lặng: con số vẫn ra, chỉ thiếu.
  if (den) dieuKien.lte = new Date(`${den}T23:59:59.999`);
  where[cot] = { ...(where[cot] as object | undefined), ...dieuKien };
}
