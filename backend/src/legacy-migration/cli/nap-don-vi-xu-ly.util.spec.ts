import { gopThanhDanhMuc, sinhDayMa, type BiDanhHeCu } from './nap-don-vi-xu-ly.util';

const bd = (p: Partial<BiDanhHeCu>): BiDanhHeCu => ({
  rawValue: 'x',
  sampleRaw: null,
  kind: 'EXTERNAL_ORG',
  recordCount: 0,
  ...p,
});

describe('gopThanhDanhMuc — chọn nhóm', () => {
  it('nạp EXTERNAL_ORG và UNKNOWN', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: 'a', sampleRaw: 'Công an phường A', kind: 'EXTERNAL_ORG' }),
      bd({ rawValue: 'b', sampleRaw: 'Chưa rõ B', kind: 'UNKNOWN' }),
    ]);
    expect(ra.map((m) => m.name).sort()).toEqual(['Chưa rõ B', 'Công an phường A']);
  });

  /**
   * TEAM đã có trong bảng `teams` — nạp lại là tạo hai nguồn cho cùng một tổ, và ô "Đơn vị xử
   * lý" nhánh nội bộ sẽ thấy tổ hai lần. RESULT là kết quả xử lý ("đã chuyển VKS"), không phải
   * đơn vị; nạp vào là để cán bộ chọn một kết quả làm nơi nhận văn bản.
   */
  it.each(['TEAM', 'RESULT'])('BỎ nhóm %s', (kind) => {
    expect(gopThanhDanhMuc([bd({ rawValue: 'x', sampleRaw: 'Đội 4', kind })])).toEqual([]);
  });
});

describe('gopThanhDanhMuc — gộp trùng', () => {
  it('ba cách viết cùng một đơn vị gộp thành MỘT mục', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: '1', sampleRaw: 'Công an Phường Bàn Cờ', recordCount: 10 }),
      bd({ rawValue: '2', sampleRaw: 'BCH Công an phường Bàn Cờ', recordCount: 3 }),
      bd({ rawValue: '3', sampleRaw: '  công an   phường bàn cờ ', recordCount: 1 }),
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].soHoSo).toBe(14);
  });

  /** Lấy biến thể gặp đầu tiên là lấy ngẫu nhiên; bản hay dùng thường là bản viết đúng. */
  it('tên hiển thị lấy từ biến thể PHỔ BIẾN nhất, không phải biến thể đầu', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: '1', sampleRaw: 'cong an phuong ban co', recordCount: 2 }),
      bd({ rawValue: '2', sampleRaw: 'Công an Phường Bàn Cờ', recordCount: 40 }),
    ]);
    expect(ra[0].name).toBe('Công an Phường Bàn Cờ');
  });

  it('bỏ qua tên đã có trong danh mục — chạy lại nhiều lần không sinh thêm', () => {
    const bd1 = [bd({ rawValue: '1', sampleRaw: 'Công an phường Bàn Cờ', recordCount: 5 })];
    expect(gopThanhDanhMuc(bd1, ['BCH Công an Phường Bàn Cờ'])).toEqual([]);
  });
});

describe('gopThanhDanhMuc — chờ duyệt và thứ tự', () => {
  it('UNKNOWN có cờ chờ duyệt và xếp SAU nhóm đã xác nhận', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: '1', sampleRaw: 'Chưa rõ', kind: 'UNKNOWN', recordCount: 999 }),
      bd({ rawValue: '2', sampleRaw: 'Công an phường A', kind: 'EXTERNAL_ORG', recordCount: 1 }),
    ]);
    const choDuyet = ra.find((m) => m.name === 'Chưa rõ')!;
    const daRo = ra.find((m) => m.name === 'Công an phường A')!;
    expect(choDuyet.choDuyet).toBe(true);
    expect(daRo.choDuyet).toBe(false);
    // Dù "Chưa rõ" có nhiều hồ sơ hơn hẳn, nó vẫn phải nằm dưới trong ô tìm.
    expect(choDuyet.order).toBeGreaterThan(daRo.order);
  });

  it('một biến thể đã được xác nhận thì cả mục hết chờ duyệt', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: '1', sampleRaw: 'Công an phường A', kind: 'UNKNOWN', recordCount: 1 }),
      bd({ rawValue: '2', sampleRaw: 'CÔNG AN PHƯỜNG A', kind: 'EXTERNAL_ORG', recordCount: 1 }),
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].choDuyet).toBe(false);
  });

  it('đơn vị hay dùng nổi lên đầu ô tìm', () => {
    const ra = gopThanhDanhMuc([
      bd({ rawValue: '1', sampleRaw: 'Ít dùng', recordCount: 1 }),
      bd({ rawValue: '2', sampleRaw: 'Hay dùng', recordCount: 500 }),
    ]);
    expect(ra[0].name).toBe('Hay dùng');
  });

  it('bỏ tên rỗng, không tạo dòng trắng trong danh mục', () => {
    expect(gopThanhDanhMuc([bd({ rawValue: '  ', sampleRaw: '   ' })])).toEqual([]);
  });
});

describe('sinhDayMa', () => {
  it('đi tiếp từ mã LỚN NHẤT, không phải từ số dòng', () => {
    // Hai dòng nhưng mã cao nhất là DV0500 — đếm dòng sẽ sinh DV0003, đụng mã đã có.
    expect(sinhDayMa(['DV0001', 'DV0500'], 2)).toEqual(['DV0501', 'DV0502']);
  });

  it('danh mục rỗng thì bắt đầu từ DV0001', () => {
    expect(sinhDayMa([], 2)).toEqual(['DV0001', 'DV0002']);
  });

  it('mã không theo mẫu thì bỏ qua, không làm hỏng dãy', () => {
    expect(sinhDayMa(['CAP-HUYEN', 'DV0007'], 1)).toEqual(['DV0008']);
  });

  it('mọi mã sinh ra đều hợp lệ với ràng buộc của cột code', () => {
    for (const m of sinhDayMa([], 50)) {
      expect(m).toMatch(/^[A-Z0-9_-]+$/);
      expect(m.length).toBeLessThanOrEqual(10);
    }
  });
});
