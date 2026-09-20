import { ngayVietDonKhiSua } from './petition-data.builder';

/**
 * Đường SỬA: cột chữ không được trôi khỏi cột ngày thật.
 *
 * Đo được trên prod ngay sau lượt deploy 20/09: một cán bộ bấm Lưu từ tab mở TRƯỚC deploy, gói
 * giao diện cũ trong tab ấy không biết cột `ngayVietDonEdtf` nên chỉ gửi `petitionDate`.
 */
describe('ngayVietDonKhiSua', () => {
  it('đổi ngày mà KHÔNG gửi cột chữ (tab cũ) → suy lại cột chữ, không giữ giá trị cũ', () => {
    const ra = ngayVietDonKhiSua({ petitionDate: '2026-05-05' });
    expect(ra.ngayVietDonEdtf).toBe('2026-05-05');
  });

  it('XOÁ TRẮNG ngày mà không gửi cột chữ → cột chữ cũng về rỗng', () => {
    const ra = ngayVietDonKhiSua({ petitionDate: null });
    expect(ra.petitionDate).toBeNull();
    expect(ra.ngayVietDonEdtf).toBeNull();
  });

  it('gửi cột chữ thiếu thành phần → giữ nguyên, ngày thật về rỗng', () => {
    const ra = ngayVietDonKhiSua({
      petitionDate: null,
      ngayVietDonEdtf: '2026-12-XX',
    });
    expect(ra.ngayVietDonEdtf).toBe('2026-12-XX');
    expect(ra.petitionDate).toBeNull();
  });

  it('cột chữ gửi lên THẮNG ngày thật, không bị suy đè', () => {
    const ra = ngayVietDonKhiSua({
      petitionDate: '2026-12-15',
      ngayVietDonEdtf: '2026-12-XX',
    });
    expect(ra.ngayVietDonEdtf).toBe('2026-12-XX');
  });

  it('không đụng tới ngày thì KHÔNG ghi khoá nào — lưu đơn cũ không được làm mất ngày', () => {
    expect(ngayVietDonKhiSua({})).toEqual({});
  });

  it('chỉ gửi cột chữ, không gửi ngày thật → chỉ ghi cột chữ', () => {
    const ra = ngayVietDonKhiSua({ ngayVietDonEdtf: '2026-XX-XX' });
    expect(ra).toEqual({ ngayVietDonEdtf: '2026-XX-XX' });
  });
});
