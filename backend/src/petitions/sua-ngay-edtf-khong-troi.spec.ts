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

/*
  Cột NGUYÊN VĂN cũng không được trôi khỏi cột ngày thật (21/09/2026).

  Chú thích của hàm này vốn viết cho cột EDTF. Từ hôm nay có HAI cột chữ, và
  `ngayVietDonHienThi` đọc cột NGUYÊN VĂN trước — nên rủi ro nó mô tả giờ đúng với cột mới, mà
  chưa ai chặn: tab cũ (gói giao diện chưa tải lại sau lượt deploy) đổi ngày thì chỉ gửi
  `petitionDate`, cột nguyên văn giữ giá trị CŨ và THẮNG khi in.

  Sai giá trị tệ hơn rỗng: rỗng thì người ta thấy, sai thì văn bản gửi ra ngoài ngành mang một
  ngày không ai kiểm lại.
*/
describe('ngayVietDonKhiSua — cột nguyên văn không trôi khỏi ngày thật', () => {
  it('client chỉ gửi ngày thật → XOÁ cột nguyên văn cũ, đừng để nó thắng khi in', () => {
    const ra = ngayVietDonKhiSua({ petitionDate: '2026-03-15' });
    expect(ra.ngayVietDonChu).toBeNull();
  });

  it('client gửi cả hai → tôn trọng đúng thứ client gửi', () => {
    const ra = ngayVietDonKhiSua({
      petitionDate: '2026-03-15',
      ngayVietDonChu: 'Không ghi ngày',
    });
    expect(ra.ngayVietDonChu).toBe('Không ghi ngày');
  });

  /*
    KHÔNG đụng ngày thật thì KHÔNG đụng cột nguyên văn — sửa một ô khác trên form không được
    lặng lẽ xoá chữ người ta đã nhập. Đây là luật "ô rỗng gửi null" của kho mã: bỏ khoá nghĩa
    là không đổi, không phải xoá.
  */
  it('client không đụng ngày → KHÔNG đụng cột nguyên văn', () => {
    expect('ngayVietDonChu' in ngayVietDonKhiSua({})).toBe(false);
  });
});
