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

  describe('Chữ ký đúng người (chống in ngược)', () => {
    /** Lấy đoạn text nằm giữa 2 mốc — để khẳng định tên nằm ĐÚNG khối chữ ký. */
    const between = (text: string, from: string, to?: string) => {
      const i = text.indexOf(from);
      expect(i).toBeGreaterThanOrEqual(0);
      const j = to ? text.indexOf(to, i) : -1;
      return text.slice(i, j >= 0 ? j : undefined);
    };

    it('BIEN_NHAN: NGƯỜI GIAO = cán bộ (người in), NGƯỜI NHẬN = người đứng đơn', () => {
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'BIEN_NHAN.docx'));
      const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));

      const khoiGiao = between(text, 'NGƯỜI GIAO', 'NGƯỜI NHẬN');
      expect(khoiGiao).toContain('«tenCanBoDeXuat»');
      expect(khoiGiao).not.toContain('«ghiTen»');

      const khoiNhan = between(text, 'NGƯỜI NHẬN');
      expect(khoiNhan).toContain('«ghiTen»');
      expect(khoiNhan).not.toContain('«tenCanBoDeXuat»');
    });

    it('PHIEU_DE_XUAT: tên người in nằm dưới "CÁN BỘ ĐỀ XUẤT"', () => {
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'PHIEU_DE_XUAT.docx'));
      const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));
      expect(between(text, 'CÁN BỘ ĐỀ XUẤT')).toContain('«tenCanBoDeXuat»');
    });
  });

  describe('Tên cán bộ = NGƯỜI IN (không phải người tạo hồ sơ)', () => {
    const nguoiTao = { firstName: 'Văn', lastName: 'Tạo', rank: 'Đại úy' };
    const nguoiIn = { firstName: 'Văn', lastName: 'In', rank: 'Trung tá' };
    const resolve = (key: string, record: any, ctx?: any) =>
      FIELD_CATALOG.DON_THU.find((f) => f.key === key)!.resolve(record, ctx);

    it('có người đăng nhập → in tên NGƯỜI ĐĂNG NHẬP', () => {
      expect(resolve('tenCanBoDeXuat', { enteredBy: nguoiTao }, { actor: nguoiIn })).toBe('Trung tá Văn In');
      expect(resolve('vietTatCanBo', { enteredBy: nguoiTao }, { actor: nguoiIn })).toBe('V.In');
    });

    it('không có ngữ cảnh → fallback người tạo hồ sơ (không để rỗng)', () => {
      expect(resolve('tenCanBoDeXuat', { enteredBy: nguoiTao })).toBe('Đại úy Văn Tạo');
      expect(resolve('vietTatCanBo', { enteredBy: nguoiTao })).toBe('V.Tạo');
    });

    it('cả hai đều thiếu → rỗng, không crash', () => {
      expect(resolve('tenCanBoDeXuat', {}, {})).toBe('');
      expect(resolve('vietTatCanBo', {})).toBe('');
    });

    // codex: actor TỒN TẠI nhưng trống họ tên (user thiếu dữ liệu) — fallback phải
    // theo GIÁ TRỊ, không theo object, nếu không dòng ký in rỗng dù có người tạo.
    it('actor tồn tại nhưng trống tên → vẫn lùi về người tạo hồ sơ', () => {
      const actorRong = { firstName: null, lastName: null, rank: null };
      expect(resolve('tenCanBoDeXuat', { enteredBy: nguoiTao }, { actor: actorRong })).toBe('Đại úy Văn Tạo');
      expect(resolve('vietTatCanBo', { enteredBy: nguoiTao }, { actor: actorRong })).toBe('V.Tạo');
    });

    // Ô "Cán bộ đề xuất" chọn trên form THẮNG cả người in — đây là điểm mấu chốt:
    // cán bộ A in hộ cho B thì văn bản vẫn phải ghi B.
    const canBoChon = { firstName: 'Văn', lastName: 'Chọn', rank: 'Thiếu tá' };

    it('có cán bộ ĐƯỢC CHỌN → thắng cả người in lẫn người tạo', () => {
      const record = { canBoDeXuat: canBoChon, enteredBy: nguoiTao };
      expect(resolve('tenCanBoDeXuat', record, { actor: nguoiIn })).toBe('Thiếu tá Văn Chọn');
      expect(resolve('vietTatCanBo', record, { actor: nguoiIn })).toBe('V.Chọn');
    });

    it('không chọn cán bộ → vẫn lùi về người in', () => {
      expect(resolve('tenCanBoDeXuat', { enteredBy: nguoiTao }, { actor: nguoiIn })).toBe('Trung tá Văn In');
    });

    it('tenNguoiIn LUÔN là người đăng nhập, không bị ô "Cán bộ đề xuất" đè', () => {
      const record = { canBoDeXuat: canBoChon, enteredBy: nguoiTao };
      expect(resolve('tenNguoiIn', record, { actor: nguoiIn })).toBe('Trung tá Văn In');
      // không có người in → lùi về người tạo
      expect(resolve('tenNguoiIn', record)).toBe('Đại úy Văn Tạo');
    });
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
