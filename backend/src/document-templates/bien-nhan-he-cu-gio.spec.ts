import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { DocxRenderer } from './renderers/docx.renderer';
import { KHOA_HE_CU_RIENG_DON_THU } from './khoa-he-cu';
import { FIELD_CATALOG } from './field-catalog';
import { normalizeDocxTags } from './docx-normalize.util';
import { thuMucMauHeCu } from '../../prisma/seed-legacy-templates';

/**
 * Legacy receipt (HE_CU_BIEN_NHAN) prints "Hồi <gio> giờ <phut> ngày …".
 * The two slots used to be blank spaces in the original .docx; they now read the declared reception time, and stay
 * blank when the record has none (never a made-up 07:00).
 */
const DELIMS = { start: '${', end: '}' };

const resolve = (key: string, record: Record<string, unknown>) => {
  const def = KHOA_HE_CU_RIENG_DON_THU.find((f) => f.key === key);
  if (!def) throw new Error(`biến ${key} chưa được khai trong KHOA_HE_CU_RIENG_DON_THU`);
  return def.resolve(record, {});
};

function docText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]*>/g, '')).join('');
}

function renderBienNhanHeCu(record: Record<string, unknown>): string {
  const file = path.join(thuMucMauHeCu(), 'bien_nhan_don_thu_mau.docx');
  const buffer = normalizeDocxTags(fs.readFileSync(file));
  const data: Record<string, string> = {};
  for (const f of FIELD_CATALOG.DON_THU) data[f.key] = String(f.resolve(record, {}) ?? '');
  return docText(new DocxRenderer().render({ buffer, data, delimiters: DELIMS }));
}

describe('biến gio / phut của mẫu hệ cũ', () => {
  it('giờ khai "09:30" → gio "09", phut "30"', () => {
    expect(resolve('gio', { gioTiepNhan: '09:30' })).toBe('09');
    expect(resolve('phut', { gioTiepNhan: '09:30' })).toBe('30');
  });

  it('00:00 và 23:59 là giờ thật, không bị coi là trống', () => {
    expect(resolve('gio', { gioTiepNhan: '00:00' })).toBe('00');
    expect(resolve('phut', { gioTiepNhan: '00:00' })).toBe('00');
    expect(resolve('gio', { gioTiepNhan: '23:59' })).toBe('23');
    expect(resolve('phut', { gioTiepNhan: '23:59' })).toBe('59');
  });

  it.each([null, undefined, '', '9:30', '24:00', '09:60', 'abc', 930])('giờ thiếu hoặc hỏng %p → trống, không bịa', (v) => {
    expect(resolve('gio', { gioTiepNhan: v })).toBe('');
    expect(resolve('phut', { gioTiepNhan: v })).toBe('');
  });

  it('hồ sơ không có cột giờ (Vụ việc / Vụ án) → trống', () => {
    expect(resolve('gio', {})).toBe('');
    expect(resolve('phut', {})).toBe('');
  });

  it('chỉ Đơn thư có biến này — Vụ việc / Vụ án không có cột giờ nên KHÔNG khai chung', () => {
    const keys = (ent: 'DON_THU' | 'VU_VIEC' | 'VU_AN') => FIELD_CATALOG[ent].map((f) => f.key);
    expect(keys('DON_THU')).toEqual(expect.arrayContaining(['gio', 'phut']));
    expect(keys('VU_VIEC')).not.toContain('gio');
    expect(keys('VU_VIEC')).not.toContain('phut');
    expect(keys('VU_AN')).not.toContain('gio');
    expect(keys('VU_AN')).not.toContain('phut');
  });
});

describe('HE_CU_BIEN_NHAN — bản in thật', () => {
  const NGAY = new Date('2026-10-08T00:00:00Z');

  it('đơn có giờ khai 08:30 → "Hồi 08 giờ 30 ngày"', () => {
    const text = renderBienNhanHeCu({ receivedDate: NGAY, ngayDeXuat: NGAY, gioTiepNhan: '08:30' });
    expect(text).toMatch(/Hồi\s+08\s+giờ\s+30\s+ngày/);
    expect(text).not.toContain('${');
  });

  it('hồ sơ không có giờ → khung trống như bản giấy, không có giờ giả', () => {
    const text = renderBienNhanHeCu({ receivedDate: NGAY, ngayDeXuat: NGAY, gioTiepNhan: null });
    expect(text).toMatch(/Hồi\s+giờ\s+ngày/);
    expect(text).not.toMatch(/07\s+giờ\s+00/);
  });

  it('file mẫu mang đúng hai chỗ điền ${gio} và ${phut}', () => {
    const file = path.join(thuMucMauHeCu(), 'bien_nhan_don_thu_mau.docx');
    const text = docText(normalizeDocxTags(fs.readFileSync(file)));
    expect(text).toContain('${gio}');
    expect(text).toContain('${phut}');
  });
});
