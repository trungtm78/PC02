import {
  sanitizeFilename,
  buildDocumentFilename,
  dedupeFilenames,
} from './filename.util';

describe('sanitizeFilename', () => {
  it('strips path separators / and \\', () => {
    expect(sanitizeFilename('5931/ĐX-PC02-Đ1.docx')).not.toContain('/');
    expect(sanitizeFilename('a\\b\\c.docx')).not.toContain('\\');
  });

  it('collapses .. traversal', () => {
    const out = sanitizeFilename('../../evil.docx');
    expect(out).not.toContain('..');
  });

  it('strips control characters and Windows-reserved characters', () => {
    for (const ch of ['?', '%', '*', ':', '|', '"', '<', '>', '\x00', '\x1f']) {
      expect(sanitizeFilename(`bad${ch}file.docx`)).not.toContain(ch);
    }
  });

  it('preserves Vietnamese diacritics (NFC normalized)', () => {
    expect(sanitizeFilename('Đơn-thư-Nguyễn-Văn-A.docx')).toBe(
      'Đơn-thư-Nguyễn-Văn-A.docx',
    );
  });

  it('caps length at 200 chars after sanitization', () => {
    const huge = 'a'.repeat(500) + '.docx';
    const out = sanitizeFilename(huge);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('prefixes Excel formula characters to defeat CSV/Excel injection in archive listings', () => {
    for (const ch of ['=', '+', '-', '@', '\t', '\r']) {
      const out = sanitizeFilename(`${ch}cmd|calc.docx`);
      expect(out.startsWith("'")).toBe(true);
    }
  });

  it('returns a safe fallback for empty or pure-junk input', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('///')).toBe('untitled');
    expect(sanitizeFilename('\x00\x01\x02')).toBe('untitled');
  });

  it('keeps a single dot for extension separation', () => {
    expect(sanitizeFilename('phieu-de-xuat.docx')).toBe('phieu-de-xuat.docx');
  });
});

/**
 * Tên file chứng từ = `Mã hồ sơ_Tên mẫu_Số văn bản`.docx — anh chốt phải "nhìn là hiểu".
 * Quy tắc CỨNG: thành phần rỗng biến mất CÙNG dấu phân cách của nó (không `_` thừa
 * đầu/cuối, không `__` giữa). Giữ dấu tiếng Việt (dùng template.name, không dùng code).
 */
describe('buildDocumentFilename', () => {
  it('đủ 3 thành phần → Mã_Tên mẫu_Số', () => {
    expect(
      buildDocumentFilename({
        recordCode: 'DT-2026-36679',
        templateName: 'Phiếu đề xuất',
        documentNumber: '0012',
      }),
    ).toBe('DT-2026-36679_Phiếu đề xuất_0012.docx');
  });

  it('THIẾU mã hồ sơ → KHÔNG có "_" mở đầu', () => {
    const out = buildDocumentFilename({
      templateName: 'Phiếu đề xuất',
      documentNumber: '0012',
    });
    expect(out).toBe('Phiếu đề xuất_0012.docx');
    expect(out.startsWith('_')).toBe(false);
  });

  it('THIẾU số văn bản → không có "_" thừa ở cuối', () => {
    expect(
      buildDocumentFilename({
        recordCode: 'DT-2026-36679',
        templateName: 'Giấy biên nhận',
      }),
    ).toBe('DT-2026-36679_Giấy biên nhận.docx');
  });

  it('thiếu CẢ HAI → chỉ còn tên mẫu', () => {
    expect(buildDocumentFilename({ templateName: 'Phiếu đề xuất' })).toBe(
      'Phiếu đề xuất.docx',
    );
  });

  it('chuỗi rỗng/khoảng trắng cũng bị coi là thiếu (không sinh "__")', () => {
    const out = buildDocumentFilename({
      recordCode: '   ',
      templateName: 'Phiếu đề xuất',
      documentNumber: '',
    });
    expect(out).toBe('Phiếu đề xuất.docx');
    expect(out).not.toContain('__');
  });

  it('GIỮ dấu tiếng Việt (không bỏ dấu)', () => {
    const out = buildDocumentFilename({
      templateName: 'Thông báo trả lại đơn',
    });
    expect(out).toBe('Thông báo trả lại đơn.docx');
  });

  it('số văn bản lấy PHẦN SỐ ĐẦU: "0012/ĐX-PC02-Đ1" → "0012"', () => {
    // '/' bị sanitizeFilename xoá → để nguyên sẽ dính liền "0012ĐX-PC02-Đ1".
    expect(
      buildDocumentFilename({
        recordCode: 'DT-2026-36679',
        templateName: 'Phiếu đề xuất',
        documentNumber: '0012/ĐX-PC02-Đ1',
      }),
    ).toBe('DT-2026-36679_Phiếu đề xuất_0012.docx');
  });

  it('vẫn đi qua sanitizeFilename (chặn path traversal trong tên mẫu)', () => {
    const out = buildDocumentFilename({ templateName: '../../evil' });
    expect(out).not.toContain('..');
    expect(out).not.toContain('/');
  });

  it('không có thành phần nào → fallback an toàn, vẫn đuôi .docx', () => {
    expect(buildDocumentFilename({})).toBe('untitled.docx');
  });

  it('nhận extension khác .docx', () => {
    expect(
      buildDocumentFilename({ templateName: 'Phụ lục', ext: 'xlsx' }),
    ).toBe('Phụ lục.xlsx');
  });

  it('[P2] tên RẤT dài vẫn GIỮ được phần mở rộng (cắt theo stem, không cắt cả tên)', () => {
    // Tên mẫu kiểu văn bản pháp lý dễ chạm ngưỡng 200 ký tự. Cắt sau khi nối đuôi sẽ
    // xén mất ".docx" → Windows không mở được file.
    const out = buildDocumentFilename({
      recordCode: 'DT-2026-36679',
      templateName:
        'Thông báo về việc tiếp nhận, thụ lý giải quyết tố giác, tin báo về tội phạm và kiến nghị khởi tố theo quy định tại Điều 147 Bộ luật Tố tụng hình sự năm 2015 sửa đổi bổ sung năm 2021 của Cơ quan điều tra',
      documentNumber: '0012',
    });
    expect(out.endsWith('.docx')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('[P2] số văn bản KHÔNG nằm ở segment đầu vẫn lấy đúng phần số', () => {
    // Series do admin cấu hình, thứ tự segment không cố định. split('/')[0] sẽ ra
    // "DX-PC02" — giống hệt nhau ở mọi hồ sơ, mất phần định danh thật.
    expect(
      buildDocumentFilename({
        recordCode: 'DT-2026-36679',
        templateName: 'Phiếu đề xuất',
        documentNumber: 'ĐX-PC02/0012',
      }),
    ).toBe('DT-2026-36679_Phiếu đề xuất_0012.docx');
  });

  it('[P2] ext bẩn được làm sạch (không tái chèn path separator sau khi stem đã sạch)', () => {
    const out = buildDocumentFilename({ templateName: 'A', ext: '../evil' });
    expect(out).not.toContain('/');
    expect(out).not.toContain('..');
  });

  it('số văn bản không có chữ số nào → giữ segment đầu, không rỗng', () => {
    expect(
      buildDocumentFilename({
        templateName: 'Phiếu',
        documentNumber: 'ABC/XYZ',
      }),
    ).toBe('Phiếu_ABC.docx');
  });
});

/**
 * archiver KHÔNG chặn entry trùng tên (ghi 2 entry cùng tên → công cụ giải nén ghi đè).
 * Tên cũ dùng template.code (unique) nên không trùng; tên mới dùng template.name →
 * 2 mẫu khác id trùng name là có thật (admin upload bản mới).
 */
describe('dedupeFilenames', () => {
  it('tên trùng → thêm hậu tố -2, -3 TRƯỚC phần mở rộng', () => {
    expect(dedupeFilenames(['a.docx', 'a.docx', 'a.docx'])).toEqual([
      'a.docx',
      'a-2.docx',
      'a-3.docx',
    ]);
  });

  it('giữ nguyên khi không trùng', () => {
    expect(dedupeFilenames(['a.docx', 'b.docx'])).toEqual(['a.docx', 'b.docx']);
  });

  it('phân biệt hoa/thường theo kiểu Windows (case-insensitive)', () => {
    // Windows/NTFS coi A.docx và a.docx là MỘT file → phải dedup.
    expect(dedupeFilenames(['A.docx', 'a.docx'])).toEqual([
      'A.docx',
      'a-2.docx',
    ]);
  });

  it('không đụng tên file không có phần mở rộng', () => {
    expect(dedupeFilenames(['manifest', 'manifest'])).toEqual([
      'manifest',
      'manifest-2',
    ]);
  });

  it('hậu tố sinh ra mà lại trùng tên có sẵn → nhảy tiếp', () => {
    expect(dedupeFilenames(['a.docx', 'a-2.docx', 'a.docx'])).toEqual([
      'a.docx',
      'a-2.docx',
      'a-3.docx',
    ]);
  });
});
