import {
  soSanh,
  NEN_TOI_THIEU_DE_CO_TY_LE,
  NEN_TOI_THIEU_DE_ON_DINH,
} from './so-sanh';

/**
 * Ca kiểm cho phép so sánh kỳ. Trọng tâm KHÔNG phải "1+1=2" mà là bốn chỗ dễ ra số sai một
 * cách trông-có-vẻ-đúng: nền bằng 0, nền quá nhỏ, chiều tốt/xấu, và làm tròn.
 */
describe('soSanh — nền bằng 0', () => {
  it('0 → 5 KHÔNG ra "tăng 500%" cũng KHÔNG ra "tăng 0%"', () => {
    const k = soSanh(5, 0);
    expect(k.tyLe).toBeNull();
    expect(k.lyDoKhongCoTyLe).toBe('NEN_BANG_KHONG');
    // Số tuyệt đối vẫn phải nói ra — đó là thứ duy nhất còn đúng.
    expect(k.chenhLech).toBe(5);
    expect(k.chieu).toBe('TANG');
  });

  it('0 → 0 là KHÔNG ĐỔI, không phải giảm', () => {
    const k = soSanh(0, 0);
    expect(k.chieu).toBe('KHONG_DOI');
    expect(k.chenhLech).toBe(0);
    expect(k.tyLe).toBeNull();
  });
});

describe('soSanh — nền quá nhỏ', () => {
  it('1 → 2 KHÔNG ra "+100%": chênh lệch thật là MỘT hồ sơ', () => {
    const k = soSanh(2, 1);
    expect(k.tyLe).toBeNull();
    expect(k.lyDoKhongCoTyLe).toBe('NEN_QUA_NHO');
    expect(k.chenhLech).toBe(1);
  });

  it('ngay dưới ngưỡng thì chặn, ngay tại ngưỡng thì cho ra tỷ lệ', () => {
    expect(soSanh(20, NEN_TOI_THIEU_DE_CO_TY_LE - 1).tyLe).toBeNull();
    expect(soSanh(20, NEN_TOI_THIEU_DE_CO_TY_LE).tyLe).not.toBeNull();
  });

  it('nền 11–20 cho ra tỷ lệ nhưng phải tự khai là DAO_DONG', () => {
    expect(soSanh(30, NEN_TOI_THIEU_DE_CO_TY_LE).doTinCay).toBe('DAO_DONG');
    expect(soSanh(30, NEN_TOI_THIEU_DE_ON_DINH - 1).doTinCay).toBe('DAO_DONG');
    expect(soSanh(30, NEN_TOI_THIEU_DE_ON_DINH).doTinCay).toBe('DU');
  });
});

describe('soSanh — chiều tốt/xấu là thuộc tính của chỉ tiêu', () => {
  it('GIẢM số vụ quá hạn là TỐT (càng cao càng xấu)', () => {
    expect(soSanh(30, 50, false).tot).toBe(true);
  });

  it('TĂNG số vụ quá hạn là XẤU', () => {
    expect(soSanh(70, 50, false).tot).toBe(false);
  });

  it('TĂNG số đã giải quyết là TỐT (càng cao càng tốt)', () => {
    expect(soSanh(70, 50, true).tot).toBe(true);
  });

  it('chỉ tiêu trung tính không phán tốt/xấu — khối lượng việc đến không phải thành tích', () => {
    expect(soSanh(70, 50, null).tot).toBeNull();
    expect(soSanh(30, 50, null).tot).toBeNull();
  });

  it('không đổi thì không phán tốt/xấu, kể cả chỉ tiêu có chiều', () => {
    expect(soSanh(50, 50, false).tot).toBeNull();
    expect(soSanh(50, 50, true).tot).toBeNull();
  });
});

describe('soSanh — không có nền', () => {
  it('nền null thì mọi con số dẫn xuất đều null, không có số 0 nào bịa ra', () => {
    const k = soSanh(42, null);
    expect(k.nen).toBeNull();
    expect(k.chenhLech).toBeNull();
    expect(k.tyLe).toBeNull();
    expect(k.lyDoKhongCoTyLe).toBe('KHONG_CO_NEN');
    expect(k.hienTai).toBe(42);
  });
});

describe('soSanh — làm tròn', () => {
  it('làm tròn 2 chữ số thập phân, đúng như báo cáo ngành viết (23,16%)', () => {
    // 7.200 so với 9.370 → -23,159...% → -23,16
    expect(soSanh(7200, 9370).tyLe).toBe(-23.16);
  });

  it('không đẻ ra đuôi dấu phẩy động', () => {
    const k = soSanh(101, 100);
    expect(k.tyLe).toBe(1);
    expect(Number.isInteger(k.tyLe! * 100)).toBe(true);
  });

  it('giảm về 0 là -100%, không phải null', () => {
    expect(soSanh(0, 40).tyLe).toBe(-100);
    expect(soSanh(0, 40).chieu).toBe('GIAM');
  });
});

describe('soSanh — bất biến trên dải rộng', () => {
  it('dấu của tỷ lệ luôn khớp chiều, với mọi cặp số', () => {
    for (let nen = 21; nen <= 400; nen += 7) {
      for (let ht = 0; ht <= 400; ht += 11) {
        const k = soSanh(ht, nen);
        if (k.chieu === 'TANG') expect(k.tyLe!).toBeGreaterThan(0);
        if (k.chieu === 'GIAM') expect(k.tyLe!).toBeLessThan(0);
        if (k.chieu === 'KHONG_DOI') expect(k.tyLe).toBe(0);
      }
    }
  });

  it('hễ có tỷ lệ thì cũng có chênh lệch — không bao giờ ngược lại thiếu', () => {
    for (let nen = 0; nen <= 60; nen++) {
      const k = soSanh(33, nen);
      if (k.tyLe !== null) expect(k.chenhLech).not.toBeNull();
    }
  });
});
