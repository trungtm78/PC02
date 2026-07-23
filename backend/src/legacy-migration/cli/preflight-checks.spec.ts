import {
  checkEpochField, checkCrimeAmbiguity, checkCrimeCoverage, checkUnknownUnits,
  checkUnclassifiedRecords, checkKeyVersion, checkTeamUniqueness, summarize,
  EXPECTED_EPOCH_REMAINDER, UNKNOWN_UNIT_BLOCK_THRESHOLD,
} from './preflight-checks';

describe('checkEpochField — không áp bừa công thức ngày cho trường chưa chứng minh', () => {
  it('100% số dư đúng → OK', () => {
    const r = checkEpochField('ngay_de_xuat', new Map([[EXPECTED_EPOCH_REMAINDER, 53819]]));
    expect(r.severity).toBe('OK');
    expect(r.detail).toContain('100,00%');
  });

  it('lẫn số dư khác đáng kể → CHẶN, vì quy đổi sẽ lệch ngày hàng loạt', () => {
    const r = checkEpochField('ngay_xay_ra', new Map([[EXPECTED_EPOCH_REMAINDER, 500], [0, 500]]));
    expect(r.severity).toBe('BLOCK');
    expect(r.detail).toContain('lệch ngày');
  });

  it('lệch rất nhỏ (≥99%) → chỉ cảnh báo', () => {
    const r = checkEpochField('ngay_thong_ke', new Map([[EXPECTED_EPOCH_REMAINDER, 995], [3600, 5]]));
    expect(r.severity).toBe('WARN');
  });

  it('không có giá trị nào → OK, không báo động giả', () => {
    expect(checkEpochField('truong_rong', new Map()).severity).toBe('OK');
  });
});

describe('checkCrimeAmbiguity / checkCrimeCoverage', () => {
  it('mã tội danh ứng nhiều tội danh → CHẶN (tra cứu sẽ lấy bừa)', () => {
    const r = checkCrimeAmbiguity([{ legacyValue: 67, crimes: 2 }]);
    expect(r.severity).toBe('BLOCK');
    expect(r.samples?.[0]).toContain('67');
  });

  it('không trùng → OK', () => {
    expect(checkCrimeAmbiguity([]).severity).toBe('OK');
  });

  it('mã dùng trong hồ sơ nhưng chưa seed → CHẶN kèm hướng dẫn chạy seed', () => {
    const r = checkCrimeCoverage([{ legacyValue: '67', records: 7449 }]);
    expect(r.severity).toBe('BLOCK');
    expect(r.detail).toContain('db:seed:crimes');
  });
});

describe('checkUnknownUnits — ngưỡng chặn theo số hồ sơ ảnh hưởng', () => {
  it(`còn giá trị ≥ ${UNKNOWN_UNIT_BLOCK_THRESHOLD} hồ sơ → CHẶN`, () => {
    const r = checkUnknownUnits([{ sample: 'Đội 8', count: 13070 }]);
    expect(r.severity).toBe('BLOCK');
  });

  it('chỉ còn lẻ tẻ → cảnh báo, vẫn nạp được', () => {
    const r = checkUnknownUnits([{ sample: 'Tổ X', count: 3 }, { sample: 'Tổ Y', count: 1 }]);
    expect(r.severity).toBe('WARN');
    expect(r.detail).toContain('4 hồ sơ');
  });

  it('phân loại hết → OK', () => {
    expect(checkUnknownUnits([]).severity).toBe('OK');
  });
});

describe('checkUnclassifiedRecords', () => {
  it('từ 1% hồ sơ trở lên không nhận diện được → CHẶN', () => {
    expect(checkUnclassifiedRecords(721, 53820).severity).toBe('BLOCK');
  });

  it('dưới 1% → cảnh báo', () => {
    expect(checkUnclassifiedRecords(50, 53820).severity).toBe('WARN');
  });

  it('không có hồ sơ nào rơi ra ngoài → OK', () => {
    expect(checkUnclassifiedRecords(0, 53820).severity).toBe('OK');
  });
});

describe('checkKeyVersion — chặn nhân đôi dữ liệu', () => {
  it('lệch phiên bản khoá → CHẶN, nói rõ hậu quả', () => {
    const r = checkKeyVersion('v1-bare-id', 'v2-collection-prefixed');
    expect(r.severity).toBe('BLOCK');
    expect(r.detail).toContain('NHÂN ĐÔI');
  });

  it('khớp hoặc chưa có lần chạy nào → OK', () => {
    expect(checkKeyVersion('v2-collection-prefixed', 'v2-collection-prefixed').severity).toBe('OK');
    expect(checkKeyVersion(null, 'v2-collection-prefixed').severity).toBe('OK');
  });
});

describe('checkTeamUniqueness — Team.name và Team.code đều @unique', () => {
  it('tên trùng → CHẶN trước khi ghi, không để lỗi giữa chừng', () => {
    const r = checkTeamUniqueness(['Đội 4', 'Đội 4'], ['D4', 'D5']);
    expect(r.severity).toBe('BLOCK');
    expect(r.samples?.some((s) => s.includes('Đội 4'))).toBe(true);
  });

  it('mã trùng → CHẶN', () => {
    expect(checkTeamUniqueness(['A', 'B'], ['X', 'X']).severity).toBe('BLOCK');
  });

  it('không trùng → OK', () => {
    expect(checkTeamUniqueness(['A', 'B'], ['X', 'Y']).severity).toBe('OK');
  });
});

describe('summarize', () => {
  it('có bất kỳ lỗi CHẶN nào → không được nạp', () => {
    const s = summarize([
      { id: 'a', title: 't', severity: 'OK', detail: '' },
      { id: 'b', title: 't', severity: 'BLOCK', detail: '' },
      { id: 'c', title: 't', severity: 'WARN', detail: '' },
    ]);
    expect(s).toEqual({ canProceed: false, blocks: 1, warns: 1 });
  });

  it('chỉ cảnh báo → vẫn nạp được', () => {
    expect(summarize([{ id: 'a', title: 't', severity: 'WARN', detail: '' }]).canProceed).toBe(true);
  });
});
