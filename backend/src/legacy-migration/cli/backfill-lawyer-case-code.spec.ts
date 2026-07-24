import { maLuatSu } from './backfill-lawyer-case-code';

describe('maLuatSu — LS-<năm>-<STT>', () => {
  it('dùng nam hợp lệ', () => {
    expect(maLuatSu('2019', '5', '5', 2026)).toBe('LS-2019-5');
  });
  it('nam=0 → lùi về năm nhập hệ', () => {
    expect(maLuatSu('0', '2', '1', 2026)).toBe('LS-2026-2');
  });
  it('nam rỗng → năm nhập hệ', () => {
    expect(maLuatSu('', '', '4', 2026)).toBe('LS-2026-4');
  });
  it('lùi stt khi stt_cu trống', () => {
    expect(maLuatSu('0', '', '7', 2026)).toBe('LS-2026-7');
  });
  it('thiếu cả stt_cu lẫn stt → undefined', () => {
    expect(maLuatSu('0', '', '', 2026)).toBeUndefined();
  });
});
