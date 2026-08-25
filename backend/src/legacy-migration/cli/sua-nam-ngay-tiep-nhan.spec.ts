import { docNgayHeCu, tinhNgayDaSua } from './sua-nam-ngay-tiep-nhan';

/** Thời điểm cố định để ca kiểm không đỏ theo ngày chạy. */
const HOM_NAY = new Date(Date.UTC(2026, 7, 25)); // 25/08/2026

describe('sua-nam-ngay-tiep-nhan', () => {
  describe('docNgayHeCu', () => {
    it('đọc được cả `d/m/yyyy` lẫn `dd/mm/yyyy` — hệ cũ dùng lẫn lộn hai dạng', () => {
      expect(docNgayHeCu('9/7/2026')).toEqual({ ngay: 9, thang: 7, nam: 2026 });
      expect(docNgayHeCu('09/07/2026')).toEqual({ ngay: 9, thang: 7, nam: 2026 });
    });

    it('trả null cho thứ không phải ngày — không đoán', () => {
      expect(docNgayHeCu('')).toBeNull();
      expect(docNgayHeCu('2026-07-09')).toBeNull();
      expect(docNgayHeCu(undefined)).toBeNull();
      expect(docNgayHeCu(123)).toBeNull();
    });
  });

  describe('tinhNgayDaSua', () => {
    it('thay năm bằng năm hồ sơ, GIỮ NGUYÊN ngày và tháng', () => {
      // Ca thật: 30/11/3023, hồ sơ năm 2023, đơn viết 20/11/2023.
      const kq = tinhNgayDaSua(new Date(Date.UTC(3023, 10, 30)), 2023, '20/11/2023', HOM_NAY);
      expect(kq).toEqual({ moi: new Date(Date.UTC(2023, 10, 30)) });
    });

    it('ca có bằng chứng mạnh nhất: ngày viết đơn TRÙNG ngày/tháng, chỉ khác năm', () => {
      // Ca thật: nhận 17/9/2925, đơn viết 17/9/2025, hồ sơ năm 2025.
      const kq = tinhNgayDaSua(new Date(Date.UTC(2925, 8, 17)), 2025, '17/9/2025', HOM_NAY);
      expect(kq).toEqual({ moi: new Date(Date.UTC(2025, 8, 17)) });
    });

    it('KHÔNG đụng hồ sơ chỉ sai tháng — năm khớp thì không có bằng chứng suy ra tháng đúng', () => {
      // Ca thật: nhận 30/9/2026, hồ sơ năm 2026 → ở tương lai nhưng năm không mâu thuẫn.
      const kq = tinhNgayDaSua(new Date(Date.UTC(2026, 8, 30)), 2026, '26/7/2026', HOM_NAY);
      expect(kq).toEqual({ boQua: 'năm ngày nhận không lớn hơn năm hồ sơ' });
    });

    it('bỏ qua khi kết quả vẫn ở tương lai', () => {
      const kq = tinhNgayDaSua(new Date(Date.UTC(2030, 11, 31)), 2026, null, HOM_NAY);
      expect(kq).toEqual({ boQua: 'kết quả vẫn ở tương lai' });
    });

    it('bỏ qua khi kết quả rơi TRƯỚC ngày viết đơn — mâu thuẫn thì không sửa bừa', () => {
      // Nhận 01/3/2027, hồ sơ năm 2026, nhưng đơn viết 15/6/2026 → 01/3/2026 là vô lý.
      const kq = tinhNgayDaSua(new Date(Date.UTC(2027, 2, 1)), 2026, '15/6/2026', HOM_NAY);
      expect(kq).toEqual({ boQua: 'kết quả TRƯỚC ngày viết đơn' });
    });

    it('bỏ qua 29/2 khi năm đích không nhuận — không để ngày tự trượt sang 1/3', () => {
      const kq = tinhNgayDaSua(new Date(Date.UTC(2028, 1, 29)), 2026, null, HOM_NAY);
      expect(kq).toEqual({ boQua: 'đổi năm làm trượt ngày (29/2)' });
    });

    it('bỏ qua khi năm hồ sơ không hợp lệ', () => {
      expect(tinhNgayDaSua(new Date(Date.UTC(2029, 2, 19)), NaN, null, HOM_NAY)).toEqual({
        boQua: 'năm hồ sơ không hợp lệ',
      });
    });

    it('không đụng hồ sơ có năm ngày nhận NHỎ HƠN năm hồ sơ — không phải lỗi rõ ràng', () => {
      const kq = tinhNgayDaSua(new Date(Date.UTC(2024, 5, 1)), 2025, null, HOM_NAY);
      expect(kq).toEqual({ boQua: 'năm ngày nhận không lớn hơn năm hồ sơ' });
    });
  });
});
