import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { DocxRenderer } from './renderers/docx.renderer';
import { FIELD_CATALOG } from './field-catalog';

/**
 * Hồi quy bộ 7 mẫu chứng từ Đơn thư (bản PC01 — TT 128/2025/TT-BCA).
 *
 * Bắt 3 lớp lỗi mà seed gate KHÔNG bắt được:
 *  1. File .docx hỏng / docxtemplater không parse được.
 *  2. Placeholder gõ sai tên → render xong vẫn còn `{tenBien}` trên giấy.
 *  3. Dữ liệu mẫu của PC01 (tên người thật, số CCCD thật) lọt vào bản phát hành.
 */
const ASSET_DIR = path.join(__dirname, '../../prisma/seed-assets/petition-docx');
const CODES = [
  'PHIEU_DE_XUAT',
  'PHIEU_CHUYEN_NGUON_TIN',
  'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN',
  'THONG_BAO_HUONG_DAN',
  'THONG_BAO_TRA_LAI',
  'BIEN_NHAN',
];

/** Dữ liệu mẫu PC01 — TUYỆT ĐỐI không được còn trong file phát hành. */
const PII_MAU = [
  'Trần Thị Vân Thanh',
  'Nguyễn Võ Uyên Trang',
  'Phạm Văn Huy',
  'Hoàng Công Việt',
  'Nguyễn Trung Hoà',
  '074306003485',
  'Võ Khánh Vy',
  'V.Huy',
];

const DELIMS = { start: '{', end: '}' };

function docText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]*>/g, ''))
    .join('');
}

/** Giá trị giả cho MỌI biến trong catalog DON_THU (đủ để render không rỗng). */
function fakeData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const f of FIELD_CATALOG.DON_THU) data[f.key] = `«${f.key}»`;
  return data;
}

describe('Bộ 7 mẫu chứng từ Đơn thư (PC01 / TT 128-2025)', () => {
  const renderer = new DocxRenderer();

  it.each(CODES)('%s: tồn tại và mọi placeholder đều thuộc catalog DON_THU', (code) => {
    const file = path.join(ASSET_DIR, `${code}.docx`);
    expect(fs.existsSync(file)).toBe(true);
    const buffer = fs.readFileSync(file);
    const vars = renderer.detectVariables(buffer, DELIMS);
    expect(vars.length).toBeGreaterThan(0);
    const allowed = new Set(FIELD_CATALOG.DON_THU.map((f) => f.key));
    const ngoaiCatalog = vars.filter((v) => !allowed.has(v));
    expect(ngoaiCatalog).toEqual([]);
  });

  it.each(CODES)('%s: render xong không còn placeholder và không lộ dữ liệu mẫu', (code) => {
    const buffer = fs.readFileSync(path.join(ASSET_DIR, `${code}.docx`));
    const out = renderer.render({ buffer, data: fakeData(), delimiters: DELIMS });
    const text = docText(out);

    // Không còn {bien} nào chưa bind
    expect(text.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g)).toBeNull();

    // Không lọt dữ liệu mẫu PC01
    for (const pii of PII_MAU) expect(text).not.toContain(pii);
  });

  it('PHIEU_DE_XUAT giữ đúng các mục nghiệp vụ của biểu mẫu PC01', () => {
    const buffer = fs.readFileSync(path.join(ASSET_DIR, 'PHIEU_DE_XUAT.docx'));
    const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));
    for (const muc of [
      'PHIẾU ĐỀ XUẤT',
      'Rà soát đơn, vụ việc, vụ án trùng:',
      'Thuộc trường hợp báo cáo',
      'Nhận thấy:',
      'Đề xuất:',
      'CÁN BỘ ĐỀ XUẤT',
    ]) {
      expect(text).toContain(muc);
    }
  });

  describe('gioTiepNhan — KHÔNG bịa giờ trên văn bản tố tụng', () => {
    const resolve = (r: any) =>
      FIELD_CATALOG.DON_THU.find((f) => f.key === 'gioTiepNhan')!.resolve(r);

    it('receivedDate chỉ có ngày (00:00) → giữ khung trống để điền tay', () => {
      const d = new Date(2026, 6, 15, 0, 0, 0); // 15/7/2026 00:00 giờ máy
      expect(resolve({ receivedDate: d })).toBe('…… giờ ……');
    });

    it('không có receivedDate → giữ khung trống', () => {
      expect(resolve({})).toBe('…… giờ ……');
      expect(resolve({ receivedDate: null })).toBe('…… giờ ……');
    });

    it('có giờ thật → in "HH giờ mm"', () => {
      const d = new Date(2026, 6, 15, 9, 5, 0);
      expect(resolve({ receivedDate: d })).toBe('09 giờ 05');
    });
  });

  it('BIEN_NHAN đúng Mẫu số 214 + có đủ mục CCCD/giờ tiếp nhận', () => {
    const buffer = fs.readFileSync(path.join(ASSET_DIR, 'BIEN_NHAN.docx'));
    const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));
    expect(text).toContain('GIẤY BIÊN NHẬN');
    expect(text).toContain('Mẫu số: 214');
    expect(text).toContain('128/2025/TT-BCA');
    expect(text).toContain('Số CCCD');
    expect(text).toContain('«soCCCD»');
    expect(text).toContain('«gioTiepNhan»');
    expect(text).toContain('NGƯỜI GIAO');
    expect(text).toContain('NGƯỜI NHẬN');
  });
});
