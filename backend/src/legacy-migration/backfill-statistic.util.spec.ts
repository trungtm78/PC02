import { statisticBackfillPatch } from './backfill-statistic.util';

const T = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const RAW = {
  id: 7,
  ngay_thong_ke: T('2026-08-10T00:00:00Z'),
  ngay_tiep_nhan_tin: T('2026-08-01T00:00:00Z'),
  so_luong_bi_hai: '3',
  xac_nhan_vu_viec_vphc: '1',
};

describe('statisticBackfillPatch — bù ô thống kê cho hồ sơ đã di trú', () => {
  it('hồ sơ chưa có dòng thống kê thì tạo mới từ bản gốc', () => {
    const { data, canTaoMoi } = statisticBackfillPatch(null, RAW);
    expect(canTaoMoi).toBe(true);
    expect(data.ngayThongKe).toBeInstanceOf(Date);
    expect(data.soLuongBiHai).toBe(3);
  });

  it('không có bản gốc thì không bù gì', () => {
    expect(statisticBackfillPatch(null, null)).toEqual({ data: {}, canTaoMoi: false });
  });

  it('bản gốc không có chỉ tiêu nào thì không tạo dòng rác', () => {
    expect(statisticBackfillPatch(null, { id: 1, tom_tat_noi_dung: 'x' })).toEqual({
      data: {},
      canTaoMoi: false,
    });
  });

  it('chỉ điền ô đang trống, KHÔNG đè giá trị cán bộ đã sửa', () => {
    const hienCo = { ngayThongKe: new Date('2020-01-01'), ngayTiepNhanTin: null, soLuongBiHai: null };
    const { data } = statisticBackfillPatch(hienCo, RAW);
    expect(data.ngayThongKe).toBeUndefined();
    expect(data.ngayTiepNhanTin).toBeInstanceOf(Date);
    expect(data.soLuongBiHai).toBe(3);
  });

  /**
   * Cột đúng-sai của bảng thống kê mang mặc định `false` ở lược đồ, nên dòng nào cũng có
   * `false` sẵn — không phân biệt được "chưa ai đụng" với "cán bộ đã bỏ tích".
   *
   * Ở đây chọn: `false` mà bản gốc nói `true` thì ĐƯỢC bù, vì `false` ấy gần như chắc chắn
   * là mặc định của lược đồ chứ không phải lựa chọn. Chiều ngược lại — bản gốc `false` và
   * cột đang `true` — KHÔNG bao giờ đè.
   */
  it('cột đúng-sai: bù được từ false mặc định lên true, nhưng không hạ true xuống false', () => {
    expect(statisticBackfillPatch({ coVPHC: false }, RAW).data.coVPHC).toBe(true);
    expect(
      statisticBackfillPatch({ coVPHC: true }, { ...RAW, xac_nhan_vu_viec_vphc: '0' }).data.coVPHC,
    ).toBeUndefined();
  });

  it('chạy lại lần hai không sinh thay đổi nào — an toàn khi lặp', () => {
    const lan1 = statisticBackfillPatch(null, RAW).data;
    const lan2 = statisticBackfillPatch(lan1, RAW).data;
    expect(lan2).toEqual({});
  });
});
