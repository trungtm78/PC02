import PizZip from 'pizzip';
import { normalizeDocxTags } from './docx-normalize.util';
import { detectDocxVariables } from './docx-variables.util';

/** Tạo .docx với body XML thô (mô phỏng Word tách run / chèn proofErr). */
function makeRawDocx(bodyXml: string): Buffer {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${bodyXml}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

function bodyXmlOf(buf: Buffer): string {
  return new PizZip(buf).file('word/document.xml')!.asText();
}

describe('normalizeDocxTags', () => {
  it('strip <w:proofErr/> (Word chèn quanh từ sai chính tả tiếng Việt)', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>Họ </w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>tên</w:t></w:r><w:proofErr w:type="spellEnd"/></w:p>',
    );
    const out = bodyXmlOf(normalizeDocxTags(buf));
    expect(out).not.toContain('proofErr');
  });

  it('gộp placeholder bị tách run → detect nhận diện được', () => {
    // {soVanBan} bị Word tách: {soV | anBan}
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>Số </w:t></w:r><w:r><w:t>{soV</w:t></w:r><w:r><w:t>anBan}</w:t></w:r></w:p>',
    );
    const normalized = normalizeDocxTags(buf);
    expect(detectDocxVariables(normalized)).toEqual(['soVanBan']);
  });

  it('placeholder tiếng Việt tách run + proofErr → gộp + detect được (delimiter «»)', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>«Họ tên </w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>người gửi»</w:t></w:r></w:p>',
    );
    const normalized = normalizeDocxTags(buf);
    expect(detectDocxVariables(normalized, { start: '«', end: '»' })).toEqual(['Họ tên người gửi']);
  });

  it('placeholder đã liền mạch → giữ nguyên detect được', () => {
    const buf = makeRawDocx('<w:p><w:r><w:t>{soVuAn}</w:t></w:r></w:p>');
    expect(detectDocxVariables(normalizeDocxTags(buf))).toEqual(['soVuAn']);
  });

  it('chuẩn hóa cả header/footer (khớp phạm vi detect)', () => {
    const zip = new PizZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>thân</w:t></w:r></w:p></w:body></w:document>');
    // header có placeholder bị tách run
    zip.file(
      'word/header1.xml',
      '<w:hdr><w:p><w:r><w:t>{tieu</w:t></w:r><w:r><w:t>De}</w:t></w:r></w:p></w:hdr>',
    );
    const out = normalizeDocxTags(zip.generate({ type: 'nodebuffer' }));
    expect(detectDocxVariables(out)).toEqual(['tieuDe']);
  });

  it('[review] buffer hỏng → trả lại nguyên buffer (không throw)', () => {
    const bad = Buffer.from('không phải docx');
    expect(normalizeDocxTags(bad)).toBe(bad);
  });
});

/**
 * Mẫu in của hệ cũ tách placeholder qua nhiều run CÓ ĐỊNH DẠNG KHÁC NHAU — Word làm vậy khi
 * người soạn bôi đậm nửa chữ, hoặc khi bộ kiểm chính tả chen vào. Bản chuẩn hoá đầu chỉ gộp
 * được run không có `<w:rPr>`, nên cả 11 mẫu hệ cũ đều dò ra tên biến rác (dài hàng trăm ký
 * tự, lẫn nguyên thẻ XML) — nghĩa là không mẫu nào dùng được.
 */
describe('normalizeDocxTags — placeholder vỡ qua run KHÁC định dạng', () => {
  it('gộp được placeholder bị cắt giữa hai run có `rPr` khác nhau', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{</w:t></w:r>' +
        '<w:r><w:rPr><w:i/></w:rPr><w:t>tom_tat_noi_dung</w:t></w:r>' +
        '<w:r><w:rPr><w:b/></w:rPr><w:t>}</w:t></w:r></w:p>',
    );
    expect(detectDocxVariables(normalizeDocxTags(buf))).toEqual(['tom_tat_noi_dung']);
  });

  it('gộp được khi tên biến bị cắt làm đôi', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{nguon</w:t></w:r>' +
        '<w:r><w:rPr><w:i/></w:rPr><w:t>_don}</w:t></w:r></w:p>',
    );
    expect(detectDocxVariables(normalizeDocxTags(buf))).toEqual(['nguon_don']);
  });

  it('hai placeholder trong một đoạn vẫn tách đúng, không dính vào nhau', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{a}</w:t></w:r>' +
        '<w:r><w:rPr><w:i/></w:rPr><w:t> và {b}</w:t></w:r></w:p>',
    );
    expect(detectDocxVariables(normalizeDocxTags(buf)).sort()).toEqual(['a', 'b']);
  });

  /** Đoạn KHÔNG chứa placeholder thì không đụng — giữ nguyên định dạng người soạn đã đặt. */
  it('đoạn không có placeholder thì giữ nguyên từng run', () => {
    const body =
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Chữ đậm</w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t> chữ nghiêng</w:t></w:r></w:p>';
    const ra = bodyXmlOf(normalizeDocxTags(makeRawDocx(body)));
    expect(ra).toContain('<w:b/>');
    expect(ra).toContain('<w:i/>');
  });

  it('placeholder nằm gọn trong một run thì không đụng gì', () => {
    const buf = makeRawDocx('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{stt}</w:t></w:r></w:p>');
    expect(detectDocxVariables(normalizeDocxTags(buf))).toEqual(['stt']);
  });
});

/**
 * Ba bẫy codex bắt được sau khi bản vá đầu đã xanh — đều làm hỏng chính văn bản gửi đi.
 */
describe('normalizeDocxTags — giữ nguyên thứ không phải chữ, và hiểu cặp `${`', () => {
  /**
   * Mẫu Word canh dòng ký, dòng địa chỉ bằng `<w:tab/>` và `<w:br/>`. Gộp run mà chỉ giữ chữ
   * là xoá luôn chúng — bố cục vỡ vĩnh viễn ngay khi nạp mẫu, không cách nào lấy lại.
   */
  it('không nuốt `<w:tab/>` và `<w:br/>` khi gộp', () => {
    const body =
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{</w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t>stt</w:t></w:r>' +
      '<w:r><w:rPr><w:b/></w:rPr><w:t>}</w:t></w:r>' +
      '<w:r><w:tab/></w:r>' +
      '<w:r><w:br/><w:t>Ký tên</w:t></w:r></w:p>';
    const ra = bodyXmlOf(normalizeDocxTags(makeRawDocx(body)));
    expect(ra).toContain('<w:tab/>');
    expect(ra).toContain('<w:br/>');
    expect(detectDocxVariables(normalizeDocxTags(makeRawDocx(body)))).toEqual(['stt']);
  });

  it('không nuốt hình ảnh trong đoạn có placeholder vỡ', () => {
    const body =
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{</w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t>stt}</w:t></w:r>' +
      '<w:r><w:drawing>ảnh</w:drawing></w:r></w:p>';
    expect(bodyXmlOf(normalizeDocxTags(makeRawDocx(body)))).toContain('<w:drawing>');
  });

  /**
   * Mẫu hệ cũ dùng cặp `${` … `}`. Word hay cắt đúng giữa `$` và `{` — khi ấy run sau chứa
   * `{stt}` trông đã trọn vẹn, nên bước gộp bỏ qua, và dò theo `${` trượt mất biến.
   */
  it('gộp được khi Word cắt giữa `$` và `{`', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>$</w:t></w:r>' +
        '<w:r><w:rPr><w:i/></w:rPr><w:t>{stt}</w:t></w:r></w:p>',
    );
    expect(detectDocxVariables(normalizeDocxTags(buf), { start: '${', end: '}' })).toEqual(['stt']);
  });
});
