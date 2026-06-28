import PizZip from 'pizzip';
import {
  buildPetitionSeedVariables,
  markRequiredByDocType,
  PETITION_SEED_META,
} from './petition-seed';

/** docx tối thiểu chứa các placeholder cho trước. */
function docx(text: string): Buffer {
  const z = new PizZip();
  z.file('word/document.xml', `<w:body><w:t>${text}</w:t></w:body>`);
  return z.generate({ type: 'nodebuffer' });
}

describe('petition-seed', () => {
  it('build variables: mọi placeholder catalog → auto + field=name', () => {
    const vars = buildPetitionSeedVariables('BIEN_NHAN', docx('{ghiTen} {noiDung} {soVanBan}'));
    expect(vars).toEqual([
      { name: 'ghiTen', label: 'ghiTen', source: 'auto', field: 'ghiTen', required: true },
      { name: 'noiDung', label: 'noiDung', source: 'auto', field: 'noiDung', required: true },
      { name: 'soVanBan', label: 'soVanBan', source: 'auto', field: 'soVanBan', required: false },
    ]);
  });

  it('required theo docType: PHIEU_DE_XUAT cần nhanThay + deXuat', () => {
    const vars = buildPetitionSeedVariables(
      'PHIEU_DE_XUAT',
      docx('{ghiTen} {noiDung} {nhanThay} {deXuat} {dinhKem}'),
    );
    const req = vars.filter((v) => v.required).map((v) => v.name);
    expect(req).toEqual(expect.arrayContaining(['ghiTen', 'nhanThay', 'deXuat']));
    expect(vars.find((v) => v.name === 'dinhKem')?.required).toBe(false);
  });

  it('GATE: placeholder NGOÀI catalog DON_THU → throw (fail seed)', () => {
    expect(() => buildPetitionSeedVariables('BIEN_NHAN', docx('{ghiTen} {khongCoTrongCatalog}'))).toThrow(
      /ngoài catalog DON_THU/,
    );
  });

  it('[codex P2] GATE: thiếu placeholder bắt buộc trong file → throw', () => {
    // PHIEU_DE_XUAT cần nhanThay+deXuat; file chỉ có ghiTen+noiDung → thiếu → throw.
    expect(() => buildPetitionSeedVariables('PHIEU_DE_XUAT', docx('{ghiTen} {noiDung}'))).toThrow(
      /thiếu placeholder bắt buộc/,
    );
  });

  it('[codex P1] markRequiredByDocType: set required theo tên TRÊN variables DB (không re-detect file)', () => {
    const dbVars = [
      { name: 'ghiTen', label: 'Tên tuỳ chỉnh', source: 'auto' as const, field: 'senderCustom', required: false },
      { name: 'dinhKem', label: 'dinhKem', source: 'manual' as const },
    ];
    const out = markRequiredByDocType('BIEN_NHAN', dbVars);
    // giữ nguyên mapping cũ (label/field admin sửa), chỉ đổi required
    expect(out[0]).toMatchObject({ label: 'Tên tuỳ chỉnh', field: 'senderCustom', required: true });
    expect(out[1].required).toBe(false);
  });

  it('PETITION_SEED_META đủ 7 docType với category hợp lệ', () => {
    const codes = Object.keys(PETITION_SEED_META);
    expect(codes).toHaveLength(7);
    const cats = ['Quyết định', 'Biên bản', 'Lệnh', 'Thông báo', 'Giấy chứng nhận', 'Kết luận', 'Khác'];
    for (const m of Object.values(PETITION_SEED_META)) {
      expect(cats).toContain(m.category);
    }
  });
});
