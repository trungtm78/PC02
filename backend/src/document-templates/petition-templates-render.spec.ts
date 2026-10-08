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

    // Giấy biên nhận ký bởi NGƯỜI TRỰC TIẾP NHẬN ĐƠN → phải dùng {tenNguoiIn},
    // KHÔNG dùng {tenCanBoDeXuat} (biến đó ưu tiên cán bộ chọn trên form, có thể
    // là người khác) — nếu không sẽ in sai người giao.
    it('BIEN_NHAN: NGƯỜI GIAO = người in, NGƯỜI NHẬN = người đứng đơn', () => {
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'BIEN_NHAN.docx'));
      const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));

      const khoiGiao = between(text, 'NGƯỜI GIAO', 'NGƯỜI NHẬN');
      expect(khoiGiao).toContain('«tenNguoiIn»');
      expect(khoiGiao).not.toContain('«ghiTen»');

      const khoiNhan = between(text, 'NGƯỜI NHẬN');
      expect(khoiNhan).toContain('«ghiTen»');
      expect(khoiNhan).not.toContain('«tenNguoiIn»');
    });

    it('BIEN_NHAN KHÔNG dùng {tenCanBoDeXuat} (tránh in cán bộ đề xuất thay người nhận đơn)', () => {
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'BIEN_NHAN.docx'));
      expect(renderer.detectVariables(buffer, DELIMS)).not.toContain('tenCanBoDeXuat');
    });

    it('PHIEU_DE_XUAT: tên người in nằm dưới "CÁN BỘ ĐỀ XUẤT"', () => {
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'PHIEU_DE_XUAT.docx'));
      const text = docText(renderer.render({ buffer, data: fakeData(), delimiters: DELIMS }));
      expect(between(text, 'CÁN BỘ ĐỀ XUẤT')).toContain('«tenCanBoDeXuat»');
    });
  });

  describe('Tên cán bộ = NGƯỜI IN (không phải người tạo hồ sơ)', () => {
    // Dữ liệu mẫu đặt đúng như CSDL thật: `lastName` = họ và tên đệm, `firstName` = tên gọi.
  const nguoiTao = { firstName: 'Tạo', lastName: 'Văn', rank: 'Đại úy' };
    const nguoiIn = { firstName: 'In', lastName: 'Văn', rank: 'Trung tá' };
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
    const canBoChon = { firstName: 'Chọn', lastName: 'Văn', rank: 'Thiếu tá' };

    it('có cán bộ ĐƯỢC CHỌN → thắng cả người in lẫn người tạo ở DÒNG KÝ', () => {
      const record = { canBoDeXuat: canBoChon, enteredBy: nguoiTao };
      expect(resolve('tenCanBoDeXuat', record, { actor: nguoiIn })).toBe('Thiếu tá Văn Chọn');
    });

    /**
     * Dòng "Lưu:" đi NGƯỢC dòng ký — cố ý, theo yêu cầu 09/09/2026.
     *
     * Dòng ký nói "ai chịu trách nhiệm về nội dung" nên theo ô "Cán bộ đề xuất". Dòng "Lưu:"
     * nói "bản này lưu ở đâu, ai giữ" nên phải là người thật sự bấm In. Trước bản này cả hai
     * cùng theo ô "Cán bộ đề xuất", nên hồ sơ A in hộ B ghi lưu ở chỗ B — sai chỗ cất.
     */
    it('dòng "Lưu:" theo NGƯỜI IN, không theo ô "Cán bộ đề xuất"', () => {
      const record = { canBoDeXuat: canBoChon, enteredBy: nguoiTao };
      expect(resolve('vietTatCanBo', record, { actor: nguoiIn })).toBe('V.In');
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

  describe('gioTiepNhan — đọc CỘT RIÊNG, KHÔNG bịa giờ trên văn bản tố tụng', () => {
    const resolve = (r: any) =>
      FIELD_CATALOG.DON_THU.find((f) => f.key === 'gioTiepNhan')!.resolve(r);

    it('có giờ khai → "HH giờ mm"', () => {
      expect(resolve({ gioTiepNhan: '09:30' })).toBe('09 giờ 30');
      expect(resolve({ gioTiepNhan: '00:05' })).toBe('00 giờ 05');
      expect(resolve({ gioTiepNhan: '23:59' })).toBe('23 giờ 59');
    });

    it('không có giờ (NULL/vắng/rỗng) → giữ khung trống để điền tay', () => {
      expect(resolve({})).toBe('…… giờ ……');
      expect(resolve({ gioTiepNhan: null })).toBe('…… giờ ……');
      expect(resolve({ gioTiepNhan: '' })).toBe('…… giờ ……');
    });

    it('giá trị hỏng trong CSDL → khung trống, KHÔNG in chuỗi rác lên văn bản', () => {
      for (const v of ['24:00', '9:30', '09:60', 'abc', '09:30:00', 930]) {
        expect(resolve({ gioTiepNhan: v })).toBe('…… giờ ……');
      }
    });

    it('LỖI "07 giờ 00" (08/10/2026): receivedDate KHÔNG còn ảnh hưởng — dù ngày lưu 00:00 UTC (= 07:00 VN)', () => {
      // Trước đây hàm đọc giờ từ receivedDate nên máy chủ giờ VN in "07 giờ 00" cho mọi đơn chưa khai giờ.
      expect(resolve({ receivedDate: new Date('2026-10-08T00:00:00Z') })).toBe('…… giờ ……');
      expect(resolve({ receivedDate: new Date('2026-10-08T00:00:00Z'), gioTiepNhan: null })).toBe('…… giờ ……');
      // Có giờ khai thì in giờ khai, bất kể phần giờ trong receivedDate.
      expect(resolve({ receivedDate: new Date('2026-10-08T03:15:00Z'), gioTiepNhan: '14:45' })).toBe('14 giờ 45');
    });
  });

  describe('ngày in ghim giờ VN — không lệch theo TZ máy chủ', () => {
    const resolve = (key: string, r: any) => FIELD_CATALOG.DON_THU.find((f) => f.key === key)!.resolve(r);

    it('ngày nhập dạng YYYY-MM-DD (00:00 UTC) in đúng ngày đó', () => {
      expect(resolve('ngayNhan', { receivedDate: new Date('2026-10-08T00:00:00Z') })).toBe('ngày 08 tháng 10 năm 2026');
    });

    it('17:00 UTC = 00:00 VN ngày hôm sau → in NGÀY HÔM SAU (máy chủ UTC trước đây in hôm trước)', () => {
      expect(resolve('ngayNhan', { receivedDate: new Date('2026-10-07T17:00:00Z') })).toBe('ngày 08 tháng 10 năm 2026');
      expect(resolve('ngayNhanNgan', { ngayTiepNhanNguonTin: new Date('2026-10-07T17:00:00Z') })).toBe('8/10/2026');
    });

    it('16:59 UTC vẫn là hôm đó', () => {
      expect(resolve('ngayNhan', { receivedDate: new Date('2026-10-07T16:59:00Z') })).toBe('ngày 07 tháng 10 năm 2026');
    });
  });

  describe('BIEN_NHAN — "Hồi … giờ …" lấy GIỜ KHAI, không cố định (08/10/2026)', () => {
    /** Dữ liệu dựng bằng CHÍNH danh mục (đúng đường in thật), không điền tay chuỗi mong đợi. */
    function renderTuBanGhi(record: Record<string, unknown>): string {
      const data: Record<string, string> = {};
      for (const f of FIELD_CATALOG.DON_THU) data[f.key] = String(f.resolve(record, {}) ?? '');
      const buffer = fs.readFileSync(path.join(ASSET_DIR, 'BIEN_NHAN.docx'));
      return docText(renderer.render({ buffer, data, delimiters: DELIMS }));
    }
    // Ngày nhập dạng YYYY-MM-DD → 00:00 UTC: đúng thứ đã sinh ra "07 giờ 00" trên máy chủ giờ VN.
    const NGAY = new Date('2026-10-08T00:00:00Z');

    it('đơn có giờ khai "09:30" → in "Hồi 09 giờ 30 ngày 08 tháng 10 năm 2026"', () => {
      const text = renderTuBanGhi({ receivedDate: NGAY, gioTiepNhan: '09:30' });
      expect(text).toContain('Hồi 09 giờ 30 ngày 08 tháng 10 năm 2026');
      expect(text).not.toContain('07 giờ 00');
    });

    it('hồ sơ CŨ chưa có giờ → khung trống để điền tay, TUYỆT ĐỐI không còn "07 giờ 00"', () => {
      for (const gio of [null, undefined, '']) {
        const text = renderTuBanGhi({ receivedDate: NGAY, gioTiepNhan: gio });
        expect(text).toContain('Hồi …… giờ …… ngày 08 tháng 10 năm 2026');
        expect(text).not.toContain('07 giờ 00');
      }
    });

    it('hai đơn cùng ngày khác giờ in hai giờ KHÁC nhau', () => {
      const a = renderTuBanGhi({ receivedDate: NGAY, gioTiepNhan: '08:05' });
      const b = renderTuBanGhi({ receivedDate: NGAY, gioTiepNhan: '16:45' });
      expect(a).toContain('Hồi 08 giờ 05 ngày');
      expect(b).toContain('Hồi 16 giờ 45 ngày');
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
