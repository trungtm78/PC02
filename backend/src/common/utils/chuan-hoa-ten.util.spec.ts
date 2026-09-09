import { boDauTiengViet, khoaDonVi } from './chuan-hoa-ten.util';
import { normalizeVi } from '../../legacy-migration/cli/org-mapper';

describe('boDauTiengViet', () => {
  it('bỏ dấu, hạ chữ thường, gộp khoảng trắng', () => {
    expect(boDauTiengViet('  Công  An   Quận  Gò Vấp ')).toBe('cong an quan go vap');
  });

  it('đổi đ/Đ thành d', () => {
    expect(boDauTiengViet('Đội Điều tra')).toBe('doi dieu tra');
  });

  /**
   * Hàm này chuyển lên từ `org-mapper.ts` của bộ di trú. Nếu hai bản trôi khỏi nhau thì bộ nạp
   * danh mục và ô "Tạo mới" trên form sẽ gộp trùng theo hai luật khác nhau — danh mục vừa dọn
   * xong lại phình lại, và không ai biết cho tới khi báo cáo theo đơn vị đếm sai.
   */
  it('KHỚP TUYỆT ĐỐI với normalizeVi của bộ di trú', () => {
    const mau = [
      'Công an Phường Bàn Cờ',
      'BCH Tổ hình sự khu vực 2 (TP. Thủ Đức cũ)',
      'Đội 3 (TT)',
      'VKSND TP. Hồ Chí Minh',
      '  nhiều   khoảng   trắng  ',
    ];
    for (const m of mau) expect(boDauTiengViet(m)).toBe(normalizeVi(m));
  });
});

describe('khoaDonVi — khoá so trùng', () => {
  /** Ba cách viết của CÙNG một đơn vị, lấy từ dữ liệu thật hệ cũ. */
  it('gộp các cách viết khác nhau của cùng một đơn vị', () => {
    const k = khoaDonVi('Công an Phường Bàn Cờ');
    expect(khoaDonVi('CÔNG AN P. BÀN CỜ')).not.toBe(k); // "P." ≠ "Phường" — không gộp bừa
    expect(khoaDonVi('BCH Công an phường Bàn Cờ')).toBe(k);
    expect(khoaDonVi('  công an   phường bàn cờ  ')).toBe(k);
  });

  it('dấu câu không làm ra hai đơn vị khác nhau', () => {
    expect(khoaDonVi('VKSND TP.HCM')).toBe(khoaDonVi('VKSND TP HCM'));
    expect(khoaDonVi('Công an Q.1')).toBe(khoaDonVi('Công an Q 1'));
  });

  it('hai đơn vị KHÁC nhau vẫn ra hai khoá khác nhau', () => {
    expect(khoaDonVi('Công an phường Bàn Cờ')).not.toBe(khoaDonVi('Công an phường Bến Nghé'));
    expect(khoaDonVi('Đội 3')).not.toBe(khoaDonVi('Đội 4'));
  });
});
