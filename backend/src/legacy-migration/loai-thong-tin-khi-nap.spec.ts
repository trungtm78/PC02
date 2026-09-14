import { chuanHoaLoaiThongTinKhiNap } from './legacy-migration.service';
import { lapChiMucLoaiThongTin } from '../petitions/loai-thong-tin.rule';

/**
 * Bộ nạp hệ cũ chuẩn hoá ô "Loại thông tin" theo danh mục `LOAI_THONG_TIN`.
 *
 * Thiếu bước này thì mỗi lần `cap-nhat-tu-he-cu` lại đổ chữ gõ tay của hệ cũ ("tố giác (02 đơn)")
 * vào hệ mới, đúng thứ đợt chuẩn hoá vừa dọn — và đơn mới nạp mang nhóm hạn TRỐNG.
 */
describe('chuanHoaLoaiThongTinKhiNap', () => {
  const chiMuc = lapChiMucLoaiThongTin([
    { name: 'Tố giác', metadata: { nhomHan: 'PHAN_ANH' } },
    {
      name: 'Khiếu nại (Quyết định tố tụng)',
      metadata: { nhomHan: 'KHIEU_NAI' },
    },
  ]);

  it('khớp mục danh mục → đổi về tên chuẩn và gán nhóm hạn của mục', () => {
    const data: Record<string, unknown> = {
      loaiThongTin: 'Khiếu nại (QĐ tố tụng)',
    };
    chuanHoaLoaiThongTinKhiNap(data, null, chiMuc);
    expect(data).toMatchObject({
      loaiThongTin: 'Khiếu nại (Quyết định tố tụng)',
      petitionType: 'KHIEU_NAI',
    });
  });

  it('không có trong danh mục → giữ nguyên chữ, nhóm hạn theo tên', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'Tố cáo cán bộ xã' };
    chuanHoaLoaiThongTinKhiNap(data, null, chiMuc);
    expect(data).toMatchObject({
      loaiThongTin: 'Tố cáo cán bộ xã',
      petitionType: 'TO_CAO',
    });
  });

  /** Nhóm hạn đã có (cán bộ chọn, hoặc đồng bộ từ Vụ án) không được bộ nạp đè khi loại KHÔNG đổi. */
  it('hồ sơ ĐÃ có nhóm hạn, loại không đổi → chuẩn hoá chữ nhưng không đổi nhóm hạn', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'tố giác (02 đơn)' };
    chuanHoaLoaiThongTinKhiNap(
      data,
      { loaiThongTin: 'Tố giác', petitionType: 'TO_CAO' },
      chiMuc,
    );
    expect(data.loaiThongTin).toBe('Tố giác');
    expect('petitionType' in data).toBe(false);
  });

  /**
   * Soát 15/09/2026: sau khi CLI gán nhóm hạn cho toàn bộ hồ sơ, `petitionType` luôn có — nếu chỉ
   * xét "đã có hay chưa" thì hệ cũ đổi loại, bộ nạp ghi loại mới mà nhóm hạn vẫn là của loại cũ,
   * lệch vĩnh viễn.
   */
  it('hồ sơ đã có nhóm hạn nhưng hệ cũ ĐỔI loại → nhóm hạn đi theo loại mới', () => {
    const data: Record<string, unknown> = {
      loaiThongTin: 'Khiếu nại (QĐ tố tụng)',
    };
    chuanHoaLoaiThongTinKhiNap(
      data,
      { loaiThongTin: 'Tố giác', petitionType: 'PHAN_ANH' },
      chiMuc,
    );
    expect(data).toMatchObject({
      loaiThongTin: 'Khiếu nại (Quyết định tố tụng)',
      petitionType: 'KHIEU_NAI',
    });
  });

  it('không có loại thông tin → không đụng gì', () => {
    const data: Record<string, unknown> = { senderName: 'A' };
    chuanHoaLoaiThongTinKhiNap(data, null, chiMuc);
    expect(data).toEqual({ senderName: 'A' });
  });

  it('danh mục rỗng (chưa nạp) → vẫn gán nhóm hạn theo tên', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'Kiến nghị' };
    chuanHoaLoaiThongTinKhiNap(data, null, lapChiMucLoaiThongTin([]));
    expect(data).toMatchObject({
      loaiThongTin: 'Kiến nghị',
      petitionType: 'KIEN_NGHI',
    });
  });
});
