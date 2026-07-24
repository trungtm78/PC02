import { maCoSo, capMaDuyNhat } from './backfill-case-code';

describe('maCoSo — VA-<năm>-<STT>', () => {
  it('dùng stt_cu khi có', () => {
    expect(maCoSo('2017', '9', '9')).toBe('VA-2017-9');
  });
  it('lùi về stt khi stt_cu trống', () => {
    expect(maCoSo('2020', '', '52')).toBe('VA-2020-52');
  });
  it('năm không hợp lệ → undefined (không bịa)', () => {
    expect(maCoSo('', '9', '9')).toBeUndefined();
    expect(maCoSo('17', '9', '')).toBeUndefined();
  });
  it('thiếu cả stt_cu lẫn stt → undefined', () => {
    expect(maCoSo('2020', '', '')).toBeUndefined();
  });
});

describe('capMaDuyNhat — chống trùng caseCode', () => {
  it('mã chưa dùng → giữ nguyên', () => {
    const set = new Set<string>();
    expect(capMaDuyNhat('VA-2017-9', set)).toBe('VA-2017-9');
  });
  it('mã trùng → thêm hậu tố -2, -3', () => {
    const set = new Set<string>(['VA-2017-9']);
    expect(capMaDuyNhat('VA-2017-9', set)).toBe('VA-2017-9-2');
    expect(capMaDuyNhat('VA-2017-9', set)).toBe('VA-2017-9-3');
  });
});
