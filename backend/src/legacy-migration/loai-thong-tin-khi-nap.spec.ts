import { chuanHoaLoaiThongTinKhiNap } from './legacy-migration.service';

/**
 * Bộ nạp hệ cũ chuẩn hoá ô "Loại thông tin" theo danh mục `LOAI_THONG_TIN`.
 *
 * Thiếu bước này thì mỗi lần `cap-nhat-tu-he-cu` lại đổ chữ gõ tay của hệ cũ ("tố giác (02 đơn)")
 * vào hệ mới, đúng thứ đợt chuẩn hoá vừa dọn — và đơn mới nạp mang nhóm hạn TRỐNG.
 */
describe('chuanHoaLoaiThongTinKhiNap', () => {
  const danhMuc = [
    { name: 'Tố giác', metadata: { nhomHan: 'PHAN_ANH' } },
    { name: 'Khiếu nại (Quyết định tố tụng)', metadata: { nhomHan: 'KHIEU_NAI' } },
  ];

  it('khớp mục danh mục → đổi về tên chuẩn và gán nhóm hạn của mục', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'Khiếu nại (QĐ tố tụng)' };
    chuanHoaLoaiThongTinKhiNap(data, null, danhMuc);
    expect(data).toMatchObject({
      loaiThongTin: 'Khiếu nại (Quyết định tố tụng)',
      petitionType: 'KHIEU_NAI',
    });
  });

  it('không có trong danh mục → giữ nguyên chữ, nhóm hạn theo tên', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'Tố cáo cán bộ xã' };
    chuanHoaLoaiThongTinKhiNap(data, null, danhMuc);
    expect(data).toMatchObject({ loaiThongTin: 'Tố cáo cán bộ xã', petitionType: 'TO_CAO' });
  });

  /** Nhóm hạn cán bộ đã chọn trên hệ mới không được bộ nạp đè — cùng luật với hướng xử lý. */
  it('hồ sơ ĐÃ có petitionType → chuẩn hoá chữ nhưng không đổi nhóm hạn', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'tố giác (02 đơn)' };
    chuanHoaLoaiThongTinKhiNap(data, { petitionType: 'TO_CAO' }, danhMuc);
    expect(data.loaiThongTin).toBe('Tố giác');
    expect('petitionType' in data).toBe(false);
  });

  it('không có loại thông tin → không đụng gì', () => {
    const data: Record<string, unknown> = { senderName: 'A' };
    chuanHoaLoaiThongTinKhiNap(data, null, danhMuc);
    expect(data).toEqual({ senderName: 'A' });
  });

  it('danh mục rỗng (chưa nạp) → vẫn gán nhóm hạn theo tên', () => {
    const data: Record<string, unknown> = { loaiThongTin: 'Kiến nghị' };
    chuanHoaLoaiThongTinKhiNap(data, null, []);
    expect(data).toMatchObject({ loaiThongTin: 'Kiến nghị', petitionType: 'KIEN_NGHI' });
  });
});
