import {
  normalizeVi, teamMatchKey, teamScopedKey, unitKindOf, teamLevelOf, teamIsActive,
  teamCodeOf, uniqueCode, roleOf, usernameOf, realEmailOf, splitFullName,
} from './org-mapper';

describe('teamMatchKey — khớp tên đơn vị giữa hai hệ', () => {
  // Tên thật lấy từ dump hệ cũ và từ bảng teams trên prod.
  it('"Đội 3" (cũ) khớp "Đội 3 (TT)" (prod) và "BCH Đội 3" (trong hồ sơ)', () => {
    expect(teamMatchKey('Đội 3')).toBe(teamMatchKey('Đội 3 (TT)'));
    expect(teamMatchKey('BCH Đội 3')).toBe(teamMatchKey('Đội 3'));
  });

  it('"Tổ Công tác Số 1" (cũ) khớp "Tổ CT số 1" (prod)', () => {
    expect(teamMatchKey('Tổ Công tác Số 1')).toBe(teamMatchKey('Tổ CT số 1'));
  });

  it('"Công an Phường Bàn Cờ" (cũ) khớp "Phường Bàn Cờ" (prod)', () => {
    expect(teamMatchKey('Công an Phường Bàn Cờ')).toBe(teamMatchKey('Phường Bàn Cờ'));
  });

  it('"Công an quận Bình Thạnh" khớp "Bình Thạnh"', () => {
    expect(teamMatchKey('Công an quận Bình Thạnh')).toBe(teamMatchKey('Bình Thạnh'));
  });

  it('KHÔNG gộp nhầm hai đơn vị khác nhau', () => {
    expect(teamMatchKey('Đội 7')).not.toBe(teamMatchKey('Tổ CT số 7'));
    expect(teamMatchKey('Phường Bình Tân')).not.toBe(teamMatchKey('Xã Bình Chánh'));
    expect(teamMatchKey('Quận 1')).not.toBe(teamMatchKey('Quận 10'));
  });

  it('bỏ khoảng trắng thừa và không phân biệt hoa thường', () => {
    expect(teamMatchKey('  ĐỘI   4 ')).toBe(teamMatchKey('Đội 4'));
  });
});

describe('teamScopedKey — KHÔNG gộp quận cũ với phường mới cùng tên', () => {
  // Lỗi thật đã xảy ra khi chạy trên dữ liệu local: khớp chỉ theo tên khiến 14 đơn vị
  // bị nuốt mất, hồ sơ của hai đơn vị khác nhau dồn về cùng một tổ.
  const CAP_HUYEN = 1;
  const CAP_XA = 2;

  it('quận Bình Tân (cấp 1) khác phường Bình Tân (cấp 2)', () => {
    expect(teamScopedKey(CAP_HUYEN, 'Bình Tân')).not.toBe(teamScopedKey(CAP_XA, 'Công an Phường Bình Tân'));
  });

  it.each([
    ['Bình Chánh', 'Công an Xã Bình Chánh'],
    ['Củ Chi', 'Công an Xã Củ Chi'],
    ['Hóc Môn', 'Công an Xã Hóc Môn'],
    ['Nhà Bè', 'Công an Xã Nhà Bè'],
    ['Cần Giờ', 'Công an Xã Cần Giờ'],
    ['Thủ Đức', 'Công an Phường Thủ Đức'],
    ['Gò Vấp', 'Công an Phường Gò Vấp'],
    ['Phú Nhuận', 'Công an Phường Phú Nhuận'],
    ['Tân Phú', 'Công an Phường Tân Phú'],
    ['Bình Thạnh', 'Công an Phường Bình Thạnh'],
    ['Tân Bình', 'Công an Phường Tân Bình'],
  ])('“%s” (quận cũ) không bị gộp với “%s”', (huyen, xa) => {
    expect(teamScopedKey(CAP_HUYEN, huyen)).not.toBe(teamScopedKey(CAP_XA, xa));
  });

  it('vẫn khớp đúng khi CÙNG cấp — không tạo trùng tổ đã có', () => {
    expect(teamScopedKey(CAP_XA, 'Công an Phường Bàn Cờ')).toBe(teamScopedKey(CAP_XA, 'Phường Bàn Cờ'));
    expect(teamScopedKey(1, 'Đội 3')).toBe(teamScopedKey(1, 'Đội 3 (TT)'));
  });
});

describe('normalizeVi', () => {
  it('bỏ dấu và đổi đ → d', () => {
    expect(normalizeVi('Đội Bình Thạnh')).toBe('doi binh thanh');
  });
});

describe('unitKindOf / teamLevelOf / teamIsActive', () => {
  it('phân loại đúng theo loai_don_vi của hệ cũ', () => {
    expect(unitKindOf('1')).toBe('ROOT');
    expect(unitKindOf('2')).toBe('CO_SO');
    expect(unitKindOf('6')).toBe('DOI');
    expect(unitKindOf('7')).toBe('TO_CONG_TAC');
    expect(unitKindOf('5')).toBe('QUAN_HUYEN');
    expect(unitKindOf('3')).toBe('PHUONG_XA');
    expect(unitKindOf(3)).toBe('PHUONG_XA'); // dump có cả kiểu số lẫn chuỗi
    expect(unitKindOf(undefined)).toBe('KHAC');
  });

  it('PC02 là gốc, phường/xã cấp 2, còn lại cấp 1', () => {
    expect(teamLevelOf('ROOT')).toBe(0);
    expect(teamLevelOf('PHUONG_XA')).toBe(2);
    expect(teamLevelOf('DOI')).toBe(1);
    expect(teamLevelOf('QUAN_HUYEN')).toBe(1);
  });

  it('quận/huyện tạo nhưng ngừng hoạt động (bãi bỏ 01/7/2025)', () => {
    expect(teamIsActive('QUAN_HUYEN')).toBe(false);
    expect(teamIsActive('PHUONG_XA')).toBe(true);
    expect(teamIsActive('DOI')).toBe(true);
  });
});

describe('teamCodeOf / uniqueCode — Team.code là @unique', () => {
  it('sinh mã từ tên rút gọn, bỏ dấu và ký tự lạ', () => {
    expect(teamCodeOf('Đ4', 'Đội 4')).toBe('D4');
    expect(teamCodeOf('Phường Bàn Cờ', 'Công an Phường Bàn Cờ')).toBe('PHUONG-BAN-CO');
  });

  it('không có tên rút gọn thì dùng tên đầy đủ', () => {
    expect(teamCodeOf(undefined, 'Tổ Truy Nã')).toBe('TO-TRUY-NA');
  });

  it('cắt còn tối đa 20 ký tự', () => {
    expect(teamCodeOf(undefined, 'Công an Phường Nguyễn Cư Trinh Mở Rộng').length).toBeLessThanOrEqual(20);
  });

  it('mã trùng → thêm hậu tố, không bao giờ trả về mã đã dùng', () => {
    const taken = new Set(['D4']);
    const c = uniqueCode('D4', taken);
    expect(c).toBe('D4-2');
    taken.add(c);
    expect(uniqueCode('D4', taken)).toBe('D4-3');
  });

  it('mã chưa dùng thì giữ nguyên', () => {
    expect(uniqueCode('D5', new Set(['D4']))).toBe('D5');
  });
});

describe('roleOf — 4 nhóm quyền cũ → 3 vai trò mới', () => {
  it('",12," Cán bộ (205 người) → OFFICER thường', () => {
    expect(roleOf(',12,')).toEqual({ roleName: 'OFFICER', canDispatch: false });
  });

  it('",11," cán bộ tham mưu đội (22 người) → OFFICER có quyền phân công', () => {
    expect(roleOf(',11,')).toEqual({ roleName: 'OFFICER', canDispatch: true });
  });

  it('",5," Quản lý tham mưu (7 người) → OFFICER có quyền phân công', () => {
    expect(roleOf(',5,')).toEqual({ roleName: 'OFFICER', canDispatch: true });
  });

  it('",," rỗng (gồm tài khoản admin, 3 người) → ADMIN', () => {
    expect(roleOf(',,')).toEqual({ roleName: 'ADMIN', canDispatch: true });
    expect(roleOf(undefined)).toEqual({ roleName: 'ADMIN', canDispatch: true });
  });
});

describe('usernameOf / realEmailOf — trường "email" hệ cũ KHÔNG phải email', () => {
  it('lấy tên đăng nhập từ cột email dù đó là chuỗi thường', () => {
    expect(usernameOf({ email: 'huyblue', so_dt: 'huyblue' })).toBe('huyblue');
    expect(usernameOf({ email: 'A4' })).toBe('A4');
  });

  it('tên đăng nhập có dấu và khoảng trắng vẫn giữ nguyên ("Đội 8")', () => {
    expect(usernameOf({ email: 'Đội 8' })).toBe('Đội 8');
  });

  it('không có email thì lùi về so_dt rồi tới ten', () => {
    expect(usernameOf({ so_dt: 'mrtea' })).toBe('mrtea');
    expect(usernameOf({ ten: 'Phạm Văn Huy' })).toBe('Phạm Văn Huy');
    expect(usernameOf({})).toBeUndefined();
  });

  it('chỉ 1/237 là email thật → chỉ giá trị đó được giữ, còn lại NULL', () => {
    expect(realEmailOf({ email: 'admin@pc02hcm.com' })).toBe('admin@pc02hcm.com');
    expect(realEmailOf({ email: 'huyblue' })).toBeUndefined();
    expect(realEmailOf({ email: 'Đội 8' })).toBeUndefined();
    expect(realEmailOf({})).toBeUndefined();
  });
});

describe('splitFullName', () => {
  it('tách phần cuối làm tên', () => {
    expect(splitFullName('Phạm Văn Huy')).toEqual({ firstName: 'Huy', lastName: 'Phạm Văn' });
  });

  it('một từ → chỉ có tên', () => {
    expect(splitFullName('Admin')).toEqual({ firstName: 'Admin' });
  });

  it('rỗng → không trả chuỗi rỗng (firstName là bắt buộc khi hiển thị)', () => {
    expect(splitFullName('   ').firstName).toBe('Không rõ');
  });
});
