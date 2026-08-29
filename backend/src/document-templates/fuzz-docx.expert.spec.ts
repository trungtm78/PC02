import fc from 'fast-check';
import PizZip from 'pizzip';
import { detectDocxVariables, DEFAULT_DELIMITERS } from './docx-variables.util';

/**
 * EXPERT fuzzing — tệp .docx là ĐẦU VÀO NGOÀI, do admin tải lên.
 *
 * ── Vì sao ──
 *
 * Ngày 28/08/2026 một đợt kiểm bảo mật để lại ba mẫu `TPL_MALICIOUS` / `TPL_XXE` /
 * `TPL_NORMAL_baseline` trên máy thật — tức lớp rủi ro này đã được nghĩ tới MỘT LẦN, nhưng
 * không để lại ca kiểm thường trực nào. Lần sau ai đổi bộ dò thì không có gì đứng canh.
 *
 * Hợp đồng của `detectDocxVariables` (khai trong chính chú thích của nó): tệp hỏng / không
 * phải zip thì trả `[]`, KHÔNG ném. Đó là bất biến cần được chứng minh trên đầu vào méo bất
 * kỳ, không phải trên vài tệp mẫu tự tay.
 *
 * Ném ra ngoài ở đây không chỉ là lỗi kỹ thuật: nó là một tệp do người ngoài kiểm soát làm sập
 * một luồng của máy chủ.
 */
function docx(noiDung: string): Buffer {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>${noiDung}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

describe('EXPERT fuzz .docx — không bao giờ ném, luôn trả mảng', () => {
  it('FZ-01 · byte ngẫu nhiên bất kỳ không làm sập bộ dò', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 4096 }), (bytes) => {
        const ra = detectDocxVariables(Buffer.from(bytes));
        expect(Array.isArray(ra)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('FZ-01b · buffer rỗng trả mảng rỗng', () => {
    expect(detectDocxVariables(Buffer.alloc(0))).toEqual([]);
  });

  /** Zip hợp lệ nhưng KHÔNG phải docx (thiếu word/document.xml). */
  it('FZ-04 · zip hợp lệ mà không phải docx thì trả rỗng, không ném', () => {
    const zip = new PizZip();
    zip.file('hello.txt', 'khong phai docx');
    const buf = zip.generate({ type: 'nodebuffer' }) as Buffer;
    expect(detectDocxVariables(buf)).toEqual([]);
  });

  /** Đuôi tệp nói dối — phải nhận theo NỘI DUNG, không theo tên. */
  it('FZ-04b · nội dung là văn bản thường dù mang đuôi .docx', () => {
    expect(detectDocxVariables(Buffer.from('day chi la van ban thuong', 'utf8'))).toEqual([]);
  });

  /** XXE: thực thể ngoài trong XML không được đọc tệp hệ thống hay gọi mạng. */
  it('FZ-02 · thực thể ngoài (XXE) không được nong ra', () => {
    const zip = new PizZip();
    zip.file(
      'word/document.xml',
      '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' +
        '<w:document><w:body><w:p><w:r><w:t>{&xxe;}</w:t></w:r></w:p></w:body></w:document>',
    );
    const buf = zip.generate({ type: 'nodebuffer' }) as Buffer;
    const ra = detectDocxVariables(buf);
    expect(Array.isArray(ra)).toBe(true);
    // Không có nội dung tệp hệ thống nào lọt vào tên biến
    for (const t of ra) expect(t).not.toMatch(/root:|\/bin\/|passwd/);
  });

  /** Placeholder không đóng / lồng nhau không được treo vòng lặp. */
  it('FZ-05 · placeholder méo không treo bộ dò', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('{', '}', 'a', ' ', '{{', '}}'), { maxLength: 300 }),
        (manh) => {
          const ra = detectDocxVariables(docx(manh.join('')));
          expect(Array.isArray(ra)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  /** Chuỗi cực dài không được làm tràn. */
  it('FZ-08 · nội dung 200.000 ký tự vẫn trả về được', () => {
    const ra = detectDocxVariables(docx('x'.repeat(200_000)));
    expect(Array.isArray(ra)).toBe(true);
  });

  /** Unicode tổ hợp / emoji / chữ có dấu — tên biến tiếng Việt là ca thường ngày của kho này. */
  it('FZ-07 · tên biến Unicode không làm hỏng phép dò', () => {
    const ra = detectDocxVariables(docx('{hoTenNguoiToGiac} {ngàyViếtĐơn} {emoji😀}'));
    expect(ra).toContain('hoTenNguoiToGiac');
    expect(ra).toContain('ngàyViếtĐơn');
  });

  /** Cặp dấu do admin khai có thể chứa ký tự đặc biệt của biểu thức chính quy. */
  it('cặp dấu chứa ký tự đặc biệt vẫn dò đúng, không vỡ biểu thức', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('[[', '((', '$$', '**', '++', '??', '«'),
        fc.constantFrom(']]', '))', '$$', '**', '++', '??', '»'),
        (mo, dong) => {
          const ra = detectDocxVariables(docx(`${mo}tenBien${dong}`), { start: mo, end: dong });
          expect(Array.isArray(ra)).toBe(true);
        },
      ),
      { numRuns: 60 },
    );
  });

  /** Không bao giờ trả tên trùng — hợp đồng "loại trùng" phải đúng trên mọi đầu vào. */
  it('không bao giờ trả tên biến trùng nhau', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c'), { maxLength: 30 }), (ten) => {
        const noi = ten.map((t) => `{${t}}`).join(' ');
        const ra = detectDocxVariables(docx(noi), DEFAULT_DELIMITERS);
        expect(new Set(ra).size).toBe(ra.length);
      }),
      { numRuns: 200 },
    );
  });
});
