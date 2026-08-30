import { describe, it, expect } from 'vitest';
import { cauSoSanh, nhacKyChuaTron, soThapPhanVN, type KetQuaSoSanh } from '../soSanhKy';

function k(p: Partial<KetQuaSoSanh>): KetQuaSoSanh {
  return {
    hienTai: 0,
    nen: 0,
    chenhLech: 0,
    tyLe: null,
    lyDoKhongCoTyLe: null,
    doTinCay: 'DU',
    chieu: 'KHONG_DOI',
    tot: null,
    ...p,
  };
}

/**
 * Câu chữ của huy hiệu so sánh.
 *
 * Huy hiệu cũ là chuỗi viết cứng `"+12%"` — hiện y hệt ở mọi tháng, mọi năm, mọi đơn vị. Bộ ca
 * kiểm này ghim ba thứ mà bản thay thế dễ nói sai:
 *   1. Không bao giờ hiện phần trăm khi không tính được.
 *   2. Chữ tăng/giảm và dấu không được chồng nhau ("giảm -23%").
 *   3. Luôn nói RÕ đang so với kỳ nào.
 */
describe('cauSoSanh — không bịa phần trăm', () => {
  it('nền bằng 0 thì nói "mới phát sinh", KHÔNG có ký tự %', () => {
    const c = cauSoSanh(
      k({ hienTai: 5, nen: 0, chenhLech: 5, chieu: 'TANG', lyDoKhongCoTyLe: 'NEN_BANG_KHONG', doTinCay: 'KHONG_DU' }),
      'tháng 8/2025',
    );
    expect(c.nhan).toBe('mới phát sinh 5');
    expect(c.nhan).not.toContain('%');
    expect(c.giaiThich).toContain('không có hồ sơ nào');
  });

  it('nền quá nhỏ thì nêu số tuyệt đối, KHÔNG nêu phần trăm', () => {
    const c = cauSoSanh(
      k({ hienTai: 2, nen: 1, chenhLech: 1, chieu: 'TANG', lyDoKhongCoTyLe: 'NEN_QUA_NHO', doTinCay: 'KHONG_DU' }),
      'tháng 8/2025',
    );
    expect(c.nhan).toBe('tăng 1');
    expect(c.nhan).not.toContain('%');
    expect(c.daoDong).toBe(true);
  });

  it('không có nền thì KHÔNG hiện huy hiệu — thà thiếu còn hơn nói bừa', () => {
    const c = cauSoSanh(k({ hienTai: 42, nen: null, lyDoKhongCoTyLe: 'KHONG_CO_NEN' }), undefined);
    expect(c.nhan).toBe('');
  });

  it('thiếu dữ liệu chỉ tiêu thì cũng không hiện gì', () => {
    expect(cauSoSanh(undefined, 'tháng 8/2025').nhan).toBe('');
  });
});

describe('cauSoSanh — chữ và dấu không chồng nhau', () => {
  it('giảm thì viết "giảm 23,16%", KHÔNG viết "giảm -23,16%"', () => {
    const c = cauSoSanh(
      k({ hienTai: 7200, nen: 9370, chenhLech: -2170, tyLe: -23.16, chieu: 'GIAM' }),
      'cùng kỳ năm 2025',
    );
    expect(c.nhan).toBe('giảm 23,16%');
    expect(c.nhan).not.toContain('-');
  });

  it('tăng thì viết "tăng …%", không có dấu cộng', () => {
    const c = cauSoSanh(k({ hienTai: 120, nen: 100, chenhLech: 20, tyLe: 20, chieu: 'TANG' }), 'tháng 7/2026');
    expect(c.nhan).toBe('tăng 20%');
    expect(c.nhan).not.toContain('+');
  });

  it('số thập phân dùng DẤU PHẨY như báo cáo ngành', () => {
    expect(soThapPhanVN(23.16)).toBe('23,16');
    expect(soThapPhanVN(20)).toBe('20');
  });

  it('không đổi thì nói không đổi, không phải "tăng 0%"', () => {
    const c = cauSoSanh(k({ hienTai: 50, nen: 50, chenhLech: 0, tyLe: 0, chieu: 'KHONG_DOI' }), 'tháng 8/2025');
    expect(c.nhan).toBe('không đổi');
    expect(c.tot).toBeNull();
  });
});

describe('cauSoSanh — luôn nói rõ so với kỳ nào', () => {
  it('câu giải thích chứa tên kỳ nền', () => {
    const c = cauSoSanh(
      k({ hienTai: 120, nen: 100, chenhLech: 20, tyLe: 20, chieu: 'TANG' }),
      'tháng 8/2025',
    );
    expect(c.giaiThich).toContain('tháng 8/2025');
    // Và nêu cả hai đầu, để con số kiểm chứng được.
    expect(c.giaiThich).toContain('100');
    expect(c.giaiThich).toContain('120');
  });

  it('nền dao động thì câu giải thích nói ra, không im', () => {
    const c = cauSoSanh(
      k({ hienTai: 20, nen: 12, chenhLech: 8, tyLe: 66.67, chieu: 'TANG', doTinCay: 'DAO_DONG' }),
      'tháng 8/2025',
    );
    expect(c.daoDong).toBe(true);
    expect(c.giaiThich).toContain('dao động');
  });
});

describe('cauSoSanh — chiều tốt/xấu đi thẳng từ máy chủ', () => {
  it('không tự suy tốt/xấu từ dấu', () => {
    const giam = k({ hienTai: 30, nen: 50, chenhLech: -20, tyLe: -40, chieu: 'GIAM', tot: true });
    expect(cauSoSanh(giam, 'x').tot).toBe(true);
    const tang = k({ hienTai: 70, nen: 50, chenhLech: 20, tyLe: 40, chieu: 'TANG', tot: false });
    expect(cauSoSanh(tang, 'x').tot).toBe(false);
  });
});

describe('nhacKyChuaTron', () => {
  it('kỳ đang chạy thì nói rõ đang so mấy ngày đầu', () => {
    const s = nhacKyChuaTron({
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 8/2026' },
      nen: { tu: '', den: '', nhan: 'tháng 8/2025 (10 ngày đầu)' },
      kyChuaTron: true,
      soNgayDaTroi: 10,
      chiTieu: {},
    });
    expect(s).toContain('chưa kết thúc');
    expect(s).toContain('10 ngày đầu');
  });

  it('kỳ đã đóng thì không nhắc gì', () => {
    expect(
      nhacKyChuaTron({
        kieu: 'CUNG_KY_NAM_TRUOC',
        ky: { tu: '', den: '', nhan: 'tháng 7/2026' },
        nen: { tu: '', den: '', nhan: 'tháng 7/2025' },
        kyChuaTron: false,
        soNgayDaTroi: null,
        chiTieu: {},
      }),
    ).toBe('');
  });
});
