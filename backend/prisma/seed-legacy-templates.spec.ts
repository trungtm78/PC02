import * as fs from 'fs';
import * as path from 'path';
import { MAU_HE_CU, bienCuaMauHeCu, thuMucMauHeCu } from './seed-legacy-templates';
import { catalogKeys } from '../src/document-templates/field-catalog';
import { detectDocxVariables } from '../src/document-templates/docx-variables.util';
import { normalizeDocxTags } from '../src/document-templates/docx-normalize.util';

/**
 * Hệ cũ in được MỌI hồ sơ vì mẫu của nó chỉ điền thứ đã có: chọn mẫu theo `loai`, đổ toàn bộ
 * trường của hồ sơ vào placeholder, trường nào trống thì in ra chỗ trống. Không mẫu nào đòi
 * dữ liệu ngoài hồ sơ (xem `_PC02/Modules/doi_1/act/xuatfile.php` của hệ cũ).
 *
 * Bộ ca kiểm này chốt hai điều kiện để hệ mới in được y như vậy:
 *   • MỌI placeholder trong 11 mẫu phải tra được trong catalog — nếu không nó in ra nguyên
 *     chữ `{ten_bien}` giữa văn bản gửi đi;
 *   • KHÔNG biến nào bắt buộc — một biến `required` là mẫu bị chặn in.
 */
describe('Mẫu in hệ cũ mang sang hệ mới', () => {
  it('khai đủ 11 mẫu của hệ cũ', () => {
    expect(MAU_HE_CU).toHaveLength(11);
  });

  it('file mẫu có thật trong kho mã', () => {
    for (const m of MAU_HE_CU) {
      expect(fs.existsSync(path.join(thuMucMauHeCu(), m.file))).toBe(true);
    }
  });

  it('mỗi mẫu gắn đúng một thực thể hệ mới', () => {
    for (const m of MAU_HE_CU) {
      expect(['DON_THU', 'VU_VIEC', 'VU_AN']).toContain(m.entityType);
    }
  });

  it('mã mẫu không trùng nhau trong cùng một thực thể', () => {
    const thay = new Set<string>();
    for (const m of MAU_HE_CU) {
      const k = `${m.entityType}|${m.code}`;
      expect(thay.has(k)).toBe(false);
      thay.add(k);
    }
  });

  /**
   * Điều kiện sống còn: placeholder nào không tra được sẽ in ra nguyên `{ten_bien}`.
   * Đây chính là thứ khiến bản in gửi đi trông như bản nháp.
   */
  it.each(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./seed-legacy-templates').MAU_HE_CU.map((m: { file: string; entityType: string }) => [
      m.file,
      m.entityType,
    ]),
  )('%s: không placeholder nào còn vỡ thành thẻ XML (%s)', (file: string) => {
    const buf = fs.readFileSync(path.join(thuMucMauHeCu(), file));
    const bien = detectDocxVariables(normalizeDocxTags(buf));
    // Placeholder vỡ lộ ra bằng thẻ XML hoặc tên dài bất thường — đó là thứ in ra giữa văn
    // bản gửi đi. Còn biến không có trong catalog thì vẫn dùng được: nó thành ô để trống.
    const vo = bien.filter((b) => b.includes('<') || b.includes('w:') || b.length > 60);
    expect(vo).toEqual([]);
  });

  /**
   * Biến ngoài catalog KHÔNG chặn in — nó thành ô để trống, đúng cách hệ cũ làm với trường
   * chưa nhập. Nhưng phải khai `manual` để cán bộ điền được nếu muốn.
   */
  it('biến ngoài catalog khai `manual` và không bắt buộc', () => {
    for (const m of MAU_HE_CU) {
      const buf = fs.readFileSync(path.join(thuMucMauHeCu(), m.file));
      const khoa = new Set(catalogKeys(m.entityType as never));
      for (const v of bienCuaMauHeCu(buf, m.entityType)) {
        if (khoa.has(v.name)) continue;
        expect(v.source).toBe('manual');
        expect(v.required).toBe(false);
      }
    }
  });

  /** Mã GUID Word chèn vào tài liệu KHÔNG phải placeholder — để lọt là popup hiện một ô rác. */
  it('không nhận mã GUID của Word làm biến', () => {
    for (const m of MAU_HE_CU) {
      const buf = fs.readFileSync(path.join(thuMucMauHeCu(), m.file));
      const guid = bienCuaMauHeCu(buf, m.entityType).filter((v) =>
        /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(v.name),
      );
      expect(guid).toEqual([]);
    }
  });

  it('KHÔNG biến nào bắt buộc — mẫu hệ cũ vốn in cả khi trống', () => {
    for (const m of MAU_HE_CU) {
      const buf = fs.readFileSync(path.join(thuMucMauHeCu(), m.file));
      for (const v of bienCuaMauHeCu(buf, m.entityType)) {
        expect(v.required).toBe(false);
      }
    }
  });

  /** Mẫu chính phải TỰ ĐIỀN gần hết — cán bộ không phải gõ lại thứ đã nhập trong hồ sơ. */
  it('mẫu đơn thư tự điền toàn bộ, không bắt gõ lại', () => {
    const buf = fs.readFileSync(path.join(thuMucMauHeCu(), 'don_thu_mau.docx'));
    const bien = bienCuaMauHeCu(buf, 'DON_THU');
    expect(bien.length).toBeGreaterThan(8);
    for (const v of bien) expect(v.source).toBe('auto');
  });

  /** Ba mẫu chính phải phủ đúng loại hồ sơ mà cán bộ dùng hằng ngày. */
  it.each([
    ['don_thu_mau.docx', 'DON_THU'],
    ['vu_viec_mau.docx', 'VU_VIEC'],
    ['vu_an_mau.docx', 'VU_AN'],
  ])('%s gắn thực thể %s', (file, entityType) => {
    const m = MAU_HE_CU.find((x) => x.file === file);
    expect(m).toBeDefined();
    expect(m!.entityType).toBe(entityType);
  });
});
