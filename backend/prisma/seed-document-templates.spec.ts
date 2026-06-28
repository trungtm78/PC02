/**
 * Test bộ mẫu chứng từ chuẩn: build .docx hợp lệ, render điền đúng placeholder (không còn {token}),
 * variables phân loại auto/manual đúng, registry hợp lệ. KHÔNG cần DB.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { buildTemplateDocx } from './seed-assets/document-templates/docx-builder';
import { TEMPLATE_SPECS } from './seed-assets/document-templates/registry';
import { detectDocxVariables } from '../src/document-templates/docx-variables.util';
import { isAutoPlaceholder, buildEntityPlaceholders } from '../src/document-templates/entity-placeholders';
import { TEMPLATE_CATEGORIES } from '../src/document-templates/document-template.constants';

describe('seed mẫu chứng từ — docx builder + registry', () => {
  it('mỗi mẫu build ra .docx hợp lệ (zip có word/document.xml) + có placeholder', async () => {
    for (const spec of TEMPLATE_SPECS) {
      const buf = await buildTemplateDocx(spec.body);
      expect(buf.length).toBeGreaterThan(0);
      const zip = new PizZip(buf);
      expect(zip.file('word/document.xml')).toBeTruthy();
      expect(detectDocxVariables(buf).length).toBeGreaterThan(0);
    }
  });

  it('VU_AN QĐ khởi tố: render điền đúng auto placeholder + không còn {token}', async () => {
    const spec = TEMPLATE_SPECS.find((s) => s.code === 'QD_KHOI_TO_VU_AN')!;
    const buf = await buildTemplateDocx(spec.body);
    const record = {
      caseCode: 'HS-2026-00007', name: 'Vụ trộm cắp tài sản', crime: 'Trộm cắp tài sản',
      investigator: { firstName: 'Nguyễn Văn', lastName: 'An' }, unit: 'Phòng Cảnh sát điều tra',
    };
    const auto = buildEntityPlaceholders('VU_AN', record);
    const manual = { diaDanh: 'TP. Hồ Chí Minh', canCu: 'kết quả xác minh', noiXayRa: 'Quận 1' };
    const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render({ ...auto, ...manual });
    const out = doc.getZip().file('word/document.xml')!.asText();
    expect(out).toContain('HS-2026-00007');
    expect(out).toContain('Vụ trộm cắp tài sản');
    expect(out).toContain('Nguyễn Văn An');
    expect(out).toContain('Phòng Cảnh sát điều tra');
    expect(out).toContain('TP. Hồ Chí Minh');
    // không còn token nào chưa render
    expect(out).not.toMatch(/\{[a-zA-Z]/);
  });

  it('VU_VIEC TB kết quả: render điền đúng + không còn {token}', async () => {
    const spec = TEMPLATE_SPECS.find((s) => s.code === 'TB_KET_QUA_GIAI_QUYET')!;
    const buf = await buildTemplateDocx(spec.body);
    const record = {
      code: 'VV-2026-00012', name: 'Tố giác đánh bạc', nguonPhatTin: 'CA_NHAN_TO_GIAC',
      donViGiaiQuyet: 'Đội 2', ngayDeXuat: new Date('2026-06-01'),
    };
    const auto = buildEntityPlaceholders('VU_VIEC', record);
    const manual = { diaDanh: 'TP. Hồ Chí Minh', nguoiNhan: 'Ông Nguyễn Văn B', ketQua: 'Đã khởi tố vụ án' };
    const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render({ ...auto, ...manual });
    const out = doc.getZip().file('word/document.xml')!.asText();
    expect(out).toContain('VV-2026-00012');
    expect(out).toContain('Tố giác đánh bạc');
    expect(out).toContain('Đội 2');
    expect(out).toContain('Đã khởi tố vụ án');
    // nguonPhatTin enum → NHÃN tiếng Việt (codex PR3), không phải mã enum
    expect(out).toContain('Cá nhân tố giác');
    expect(out).not.toContain('CA_NHAN_TO_GIAC');
    // ngayTiepNhan lấy từ ngayDeXuat (Đ.146) → có năm 2026
    expect(out).toContain('năm 2026');
    expect(out).not.toMatch(/\{[a-zA-Z]/);
  });

  it('variables phân loại auto/manual đúng', () => {
    expect(isAutoPlaceholder('VU_AN', 'soVuAn')).toBe(true);
    expect(isAutoPlaceholder('VU_AN', 'dieuTraVien')).toBe(true);
    expect(isAutoPlaceholder('VU_AN', 'hoTenBiCan')).toBe(false);
    expect(isAutoPlaceholder('VU_VIEC', 'soVuViec')).toBe(true);
    expect(isAutoPlaceholder('VU_VIEC', 'diaDanh')).toBe(false);
  });

  it('registry: code unique; mỗi entityType có ≥1 mẫu; category hợp lệ', () => {
    const keys = TEMPLATE_SPECS.map((s) => `${s.entityType}/${s.code}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TEMPLATE_SPECS.filter((s) => s.entityType === 'VU_AN').length).toBeGreaterThanOrEqual(1);
    expect(TEMPLATE_SPECS.filter((s) => s.entityType === 'VU_VIEC').length).toBeGreaterThanOrEqual(1);
    // category mỗi mẫu PHẢI thuộc TEMPLATE_CATEGORIES backend (DTO @IsIn) — tránh seed giá trị admin không chọn lại được.
    for (const s of TEMPLATE_SPECS) expect((TEMPLATE_CATEGORIES as readonly string[]).includes(s.category)).toBe(true);
  });
});
