import {
  giaiKyThongKe,
  apDungKyVaoWhere,
  KY_THONG_KE,
  TRUONG_NGAY_THONG_KE,
  MAC_DINH_KY,
} from './thong-ke-ky.util';

/**
 * Kỳ thống kê — giải cấu hình của admin thành một khoảng ngày cụ thể.
 *
 * Hàm thuần, nhận `now` từ ngoài để ca kiểm cố định được thời điểm. Đây là nơi duy nhất tính
 * mốc kỳ trong toàn hệ thống: thẻ số, danh sách và badge menu đều gọi vào đây, nên sai ở đây
 * là ba chỗ cùng sai theo một kiểu.
 */
const NGAY_15_8 = new Date(2026, 7, 15, 10, 30); // 15/08/2026 — giữa quý III

describe('giaiKyThongKe', () => {
  it('THANG_HIEN_TAI → đầu và cuối tháng chứa `now`', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.THANG_HIEN_TAI }, NGAY_15_8);

    expect(ky.tuNgay).toBe('2026-08-01');
    expect(ky.denNgay).toBe('2026-08-31');
  });

  it('QUY_HIEN_TAI → đầu và cuối quý chứa `now` (15/08 thuộc quý III)', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.QUY_HIEN_TAI }, NGAY_15_8);

    expect(ky.tuNgay).toBe('2026-07-01');
    expect(ky.denNgay).toBe('2026-09-30');
  });

  it('NAM_HIEN_TAI → 01/01 đến 31/12', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.NAM_HIEN_TAI }, NGAY_15_8);

    expect(ky.tuNgay).toBe('2026-01-01');
    expect(ky.denNgay).toBe('2026-12-31');
  });

  /**
   * `TAT_CA` phải trả KHÔNG MỐC NÀO.
   *
   * Cái bẫy: trả `{ tuNgay: '', denNgay: '' }` rồi để tầng gọi tự hiểu. Chuỗi rỗng đi vào
   * `new Date('')` ra `Invalid Date`, Prisma nhận vào và truy vấn trả 0 dòng — mọi con số về
   * 0 mà không có lỗi nào được ném ra. Trả `null` tường minh thì tầng gọi buộc phải xử lý.
   */
  it('TAT_CA → không mốc nào, KHÔNG được lặng lẽ thành một khoảng', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.TAT_CA }, NGAY_15_8);

    expect(ky.tuNgay).toBeNull();
    expect(ky.denNgay).toBeNull();
  });

  it('KHOANG_TUY_CHON → dùng đúng hai mốc admin nhập', () => {
    const ky = giaiKyThongKe(
      { ky: KY_THONG_KE.KHOANG_TUY_CHON, tuNgay: '2025-03-01', denNgay: '2025-06-30' },
      NGAY_15_8,
    );

    expect(ky.tuNgay).toBe('2025-03-01');
    expect(ky.denNgay).toBe('2025-06-30');
  });

  it('KHOANG_TUY_CHON thiếu mốc → rơi về mặc định, KHÔNG ném lỗi', () => {
    // Admin chọn "khoảng tuỳ chọn" rồi quên nhập ngày. Ném lỗi ở đây là cả thanh menu và ba
    // trang danh sách cùng vỡ vì một ô cấu hình bỏ trống.
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.KHOANG_TUY_CHON }, NGAY_15_8);

    expect(ky.tuNgay).toBe('2026-08-01');
    expect(ky.denNgay).toBe('2026-08-31');
  });

  it('giá trị cấu hình lạ (khoá bị sửa tay trong DB) → rơi về mặc định', () => {
    const ky = giaiKyThongKe({ ky: 'KY_KHONG_TON_TAI' }, NGAY_15_8);

    expect(ky.ky).toBe(MAC_DINH_KY);
    expect(ky.tuNgay).toBe('2026-08-01');
  });

  it('mặc định khi chưa cấu hình gì là THÁNG HIỆN TẠI theo NGÀY TIẾP NHẬN', () => {
    const ky = giaiKyThongKe({}, NGAY_15_8);

    expect(ky.ky).toBe(KY_THONG_KE.THANG_HIEN_TAI);
    expect(ky.truong).toBe(TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN);
  });

  it('chọn NGAY_TAO thì trả đúng trường ấy', () => {
    const ky = giaiKyThongKe({ truong: TRUONG_NGAY_THONG_KE.NGAY_TAO }, NGAY_15_8);

    expect(ky.truong).toBe(TRUONG_NGAY_THONG_KE.NGAY_TAO);
  });

  /**
   * MỐC TÍNH THEO GIỜ ĐỊA PHƯƠNG, KHÔNG PHẢI UTC.
   *
   * Máy chủ chạy múi giờ +7. Dùng `toISOString().slice(0,10)` thì 01/08 lúc 00:00 giờ Việt
   * Nam ra "2026-07-31" — kỳ hụt mất ngày đầu và dôi ra ngày cuối. Với thống kê tháng, hồ sơ
   * tiếp nhận đúng ngày mùng 1 sẽ biến mất khỏi báo cáo.
   */
  it('mốc tính theo giờ địa phương — ngày mùng 1 không được rơi sang tháng trước', () => {
    const dungNuaDem = new Date(2026, 7, 1, 0, 0, 0); // 01/08/2026 00:00 giờ địa phương
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.THANG_HIEN_TAI }, dungNuaDem);

    expect(ky.tuNgay).toBe('2026-08-01');
  });

  it('tháng 2 năm nhuận ra đúng 29 ngày', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.THANG_HIEN_TAI }, new Date(2028, 1, 10));

    expect(ky.denNgay).toBe('2028-02-29');
  });

  it('quý IV kết thúc 31/12', () => {
    const ky = giaiKyThongKe({ ky: KY_THONG_KE.QUY_HIEN_TAI }, new Date(2026, 10, 20));

    expect(ky.tuNgay).toBe('2026-10-01');
    expect(ky.denNgay).toBe('2026-12-31');
  });
});

/**
 * Áp kỳ vào điều kiện truy vấn.
 *
 * Sáu chỗ gọi (danh sách + thống kê của ba module) đều đi qua đây. Để mỗi chỗ tự dựng điều
 * kiện ngày là sáu chỗ để lệch nhau, và lệch kiểu này thì thẻ số nói một đằng danh sách nói
 * một nẻo — đúng thứ anh chốt là không được xảy ra.
 */
describe('apDungKyVaoWhere', () => {
  const KY_THANG = {
    ky: KY_THONG_KE.THANG_HIEN_TAI,
    truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN,
    tuNgay: '2026-08-01',
    denNgay: '2026-08-31',
  } as const;

  it('không có ngày người dùng → dùng mốc của kỳ, trên cột tiếp nhận', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(where, KY_THANG, undefined, undefined, 'receivedDate');

    expect(where.receivedDate).toEqual({
      gte: new Date('2026-08-01T00:00:00'),
      lte: new Date('2026-08-31T23:59:59.999'),
    });
  });

  /**
   * Mốc CUỐI phải là cuối ngày, không phải nửa đêm.
   *
   * `new Date('2026-08-31')` là 00:00 ngày 31 — mọi hồ sơ tiếp nhận TRONG ngày 31 đều lớn
   * hơn mốc ấy và rơi khỏi kỳ. Thống kê tháng mất trọn ngày cuối tháng, mất im lặng: con số
   * vẫn ra, chỉ thiếu. Ngày cuối tháng lại là ngày cán bộ chốt sổ.
   */
  it('mốc CUỐI là cuối ngày — không được cắt mất ngày cuối kỳ', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(where, KY_THANG, undefined, undefined, 'receivedDate');

    const lte = (where.receivedDate as { lte: Date }).lte;
    expect(lte.getDate()).toBe(31);
    expect(lte.getHours()).toBe(23);
  });

  it('người dùng đặt ngày → ngày người dùng THẮNG mốc của kỳ', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(where, KY_THANG, '2025-01-01', '2025-01-31', 'receivedDate');

    expect(where.receivedDate).toEqual({
      gte: new Date('2025-01-01T00:00:00'),
      lte: new Date('2025-01-31T23:59:59.999'),
    });
  });

  it('người dùng chỉ đặt MỘT đầu → đầu kia vẫn lấy theo kỳ', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(where, KY_THANG, '2026-08-10', undefined, 'receivedDate');

    expect(where.receivedDate).toEqual({
      gte: new Date('2026-08-10T00:00:00'),
      lte: new Date('2026-08-31T23:59:59.999'),
    });
  });

  it('kỳ NGAY_TAO → lọc theo createdAt, KHÔNG đụng cột tiếp nhận', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(
      where,
      { ...KY_THANG, truong: TRUONG_NGAY_THONG_KE.NGAY_TAO },
      undefined,
      undefined,
      'receivedDate',
    );

    expect(where.createdAt).toBeDefined();
    expect(where.receivedDate).toBeUndefined();
  });

  it('kỳ TAT_CA và người dùng không đặt ngày → KHÔNG thêm điều kiện nào', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(
      where,
      { truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN, tuNgay: null, denNgay: null },
      undefined,
      undefined,
      'receivedDate',
    );

    expect(where.receivedDate).toBeUndefined();
    expect(where.createdAt).toBeUndefined();
  });

  it('kỳ TAT_CA nhưng người dùng CÓ đặt ngày → vẫn lọc theo ngày người dùng', () => {
    const where: Record<string, unknown> = {};
    apDungKyVaoWhere(
      where,
      { truong: TRUONG_NGAY_THONG_KE.NGAY_TIEP_NHAN, tuNgay: null, denNgay: null },
      '2024-05-01',
      undefined,
      'receivedDate',
    );

    expect(where.receivedDate).toEqual({ gte: new Date('2024-05-01T00:00:00') });
  });
});
