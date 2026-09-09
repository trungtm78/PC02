import { buildTemplatePlaceholders, type TemplateVariable } from './entity-placeholders';

/**
 * Ô người dùng để TRỐNG không được xoá trắng giá trị hồ sơ đã có.
 *
 * ── Lỗi thật, tái hiện trên máy chủ 09/09/2026 ──
 *
 * `manualValues[tên] ?? resolveField(...)` — `??` chỉ lùi khi `null`/`undefined`. Chuỗi RỖNG đi
 * thẳng qua và ghi đè giá trị lấy từ hồ sơ. Cán bộ mở popup "bổ sung thông tin thiếu", chạm vào
 * một ô rồi để trống là ô ấy mất chữ trên văn bản gửi đi — hồ sơ vẫn có dữ liệu, bản in thì không.
 *
 * Đo trên máy thật, cùng một hồ sơ:
 *   manualValues {}                  → "Kính gửi: PC01 Công an TP. HCM"
 *   manualValues {donViNhan: ""}     → "Kính gửi:"   ← trống
 *
 * Không lộ ra ở bất kỳ ca kiểm nào trước đó vì mọi ca đều truyền `{}`.
 */
const HO_SO = { donViGiaiQuyet: 'PC01 Công an TP. HCM', senderName: 'Ngô Thị Hương', stt: '2026-11244' };
const BIEN: TemplateVariable[] = [
  { name: 'donViNhan', source: 'auto', field: 'donViNhan' },
  { name: 'ghiTen', source: 'auto', field: 'ghiTen' },
  { name: 'soVanBan', source: 'auto', field: 'soVanBan' },
  { name: 'ghiChuTay', source: 'manual' },
];

const dung = (manual: Record<string, string>) =>
  buildTemplatePlaceholders('DON_THU', BIEN, HO_SO, manual);

describe('ô để trống không xoá trắng giá trị hồ sơ', () => {
  it('không gửi gì → lấy từ hồ sơ', () => {
    expect(dung({}).donViNhan).toBe('PC01 Công an TP. HCM');
  });

  it('gửi chuỗi RỖNG → vẫn lấy từ hồ sơ, KHÔNG in trống', () => {
    expect(dung({ donViNhan: '' }).donViNhan).toBe('PC01 Công an TP. HCM');
  });

  it('gửi toàn khoảng trắng → cũng coi như không nhập', () => {
    expect(dung({ donViNhan: '   ' }).donViNhan).toBe('PC01 Công an TP. HCM');
  });

  it('gửi giá trị THẬT → dùng giá trị người dùng nhập', () => {
    expect(dung({ donViNhan: 'Công an quận 1' }).donViNhan).toBe('Công an quận 1');
  });

  it('cùng luật cho mọi ô tự điền, không riêng đơn vị', () => {
    expect(dung({ ghiTen: '' }).ghiTen).toBe('Ngô Thị Hương');
  });

  /** Số văn bản đi nhánh riêng nên phải kiểm riêng — cùng bẫy `??`. */
  it('số văn bản rỗng → vẫn lùi về STT hồ sơ', () => {
    expect(dung({ soVanBan: '' }).soVanBan).toBe('11244');
  });

  /** Ô thủ công KHÔNG có nguồn nào để lùi về — rỗng vẫn là rỗng, đúng ý người dùng. */
  it('ô thủ công để trống thì vẫn trống', () => {
    expect(dung({ ghiChuTay: '' }).ghiChuTay).toBe('');
  });
});
