import PizZip from 'pizzip';

import { ngatDoanNhuHeCu, DAU_NGAT_DOAN, PPR_DONG_TIEP } from './ngat-doan-he-cu';

/**
 * Ô nhiều dòng phải thành NHIỀU ĐOẠN WORD, đúng như hệ cũ in ra.
 *
 * Đo trên bản in thật của hệ cũ ngày 09/09/2026 (bốn mẫu, `HE_CU_VU_AN` · `HE_CU_UY_THAC` ·
 * `HE_CU_TRAO_DOI` · `HE_CU_TRA_HO_SO`): dòng ĐẦU giữ nguyên thuộc tính đoạn của mẫu, mỗi dòng
 * SAU là một đoạn mới với đúng một bộ thuộc tính, giống hệt nhau ở cả bốn mẫu:
 *
 *     <w:spacing w:before="60"/><w:ind w:firstLine="709"/><w:jc w:val="both"/>
 *
 * Hệ mới đang dùng ngắt dòng mềm `<w:br/>` (docxtemplater `linebreaks: true`) — chữ giống hệt
 * nên phép so chữ không thấy, và báo cáo 28/08 xếp nó là "trình bày, không phải dữ liệu" rồi
 * bỏ qua. Đặt hai tệp cạnh nhau thì đó là khác biệt đập vào mắt trước tiên.
 */
function xmlCua(b: Buffer): string {
  return new PizZip(b).files['word/document.xml'].asText();
}

function cacDoan(xml: string): string[] {
  return xml.match(/<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? [];
}

function chuCua(doan: string): string {
  return doan.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function pPrCua(doan: string): string {
  return (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(doan)?.[0] ?? '')
    .replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, '')
    .replace(/<w:pPr>|<\/w:pPr>/g, '');
}

/** Một tài liệu tối thiểu: một đoạn có thuộc tính riêng, chứa một chỗ điền. */
function docxMau(noiDungDoan: string): Buffer {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document><w:body>${noiDungDoan}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

const DOAN_MAU =
  '<w:p><w:pPr><w:spacing w:before="120" w:after="120"/><w:ind w:firstLine="720"/>' +
  '<w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:sz w:val="28"/></w:rPr>' +
  '<w:t>NOI_DUNG</w:t></w:r></w:p>';

describe('ngatDoanNhuHeCu', () => {
  it('mỗi dòng thành một ĐOẠN riêng, không phải ngắt dòng mềm', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}hai${DAU_NGAT_DOAN}ba`));

    const doan = cacDoan(xmlCua(ngatDoanNhuHeCu(vao)));

    expect(doan.map(chuCua)).toEqual(['một', 'hai', 'ba']);
    expect(xmlCua(ngatDoanNhuHeCu(vao))).not.toContain('<w:br/>');
  });

  it('dòng ĐẦU giữ nguyên thuộc tính đoạn của mẫu', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}hai`));

    const doan = cacDoan(xmlCua(ngatDoanNhuHeCu(vao)));

    expect(pPrCua(doan[0])).toBe(
      '<w:spacing w:before="120" w:after="120"/><w:ind w:firstLine="720"/><w:jc w:val="both"/>',
    );
  });

  it('mỗi dòng SAU mang đúng bộ thuộc tính đo được từ bản in hệ cũ', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}hai${DAU_NGAT_DOAN}ba`));

    const doan = cacDoan(xmlCua(ngatDoanNhuHeCu(vao)));

    expect(pPrCua(doan[1])).toBe(PPR_DONG_TIEP);
    expect(pPrCua(doan[2])).toBe(PPR_DONG_TIEP);
  });

  /**
   * Kiểu CHỮ của dòng sau phải theo dòng trước.
   *
   * Mất `<w:rPr>` là cỡ chữ rơi về mặc định của tài liệu: dòng đầu 14, những dòng sau 11 — một
   * bản in vỡ mà không có gì báo.
   */
  it('giữ kiểu chữ của run cho các dòng sau', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}hai`));

    const doan = cacDoan(xmlCua(ngatDoanNhuHeCu(vao)));

    expect(doan[1]).toContain('<w:sz w:val="28"/>');
  });

  it('không có dấu ngắt thì tài liệu KHÔNG đổi một byte nào', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', 'một dòng thôi'));

    expect(xmlCua(ngatDoanNhuHeCu(vao))).toBe(xmlCua(vao));
  });

  /**
   * `<w:br/>` do CHÍNH MẪU viết ra phải để yên.
   *
   * Chỉ những lần xuống dòng đến từ DỮ LIỆU mới thành đoạn — đó là lý do dùng dấu riêng thay vì
   * đi tìm `<w:br/>` trong bản đã dựng: sau khi dựng thì hai nguồn không còn phân biệt được.
   */
  it('ngắt dòng do mẫu tự viết được giữ nguyên', () => {
    const vao = docxMau(
      '<w:p><w:r><w:t>a</w:t><w:br/><w:t>b</w:t></w:r></w:p>',
    );

    expect(xmlCua(ngatDoanNhuHeCu(vao))).toContain('<w:br/>');
  });

  it('dấu ngắt KHÔNG được lọt ra bản in', () => {
    const vao = docxMau(DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}hai`));

    expect(xmlCua(ngatDoanNhuHeCu(vao))).not.toContain(DAU_NGAT_DOAN);
  });

  it('dòng rỗng giữa hai dòng vẫn thành một đoạn rỗng — hệ cũ in ra khoảng trắng ấy', () => {
    const vao = docxMau(
      DOAN_MAU.replace('NOI_DUNG', `một${DAU_NGAT_DOAN}${DAU_NGAT_DOAN}ba`),
    );

    expect(cacDoan(xmlCua(ngatDoanNhuHeCu(vao))).map(chuCua)).toEqual(['một', '', 'ba']);
  });
});
