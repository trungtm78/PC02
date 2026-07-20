/**
 * Tiện ích đọc/ghi .docx ở mức XML — KHÔNG dùng thư viện parse XML nặng, chỉ
 * quét theo tag để giữ NGUYÊN VẸN mọi thuộc tính/định dạng gốc của Word.
 *
 * Dùng cho việc "templatize": tách file nhiều chứng từ thành từng file và thay
 * dữ liệu mẫu bằng placeholder {tenBien}, giữ đúng bố cục PC01.
 */
import fs from 'node:fs';
import PizZip from '../../../backend/node_modules/pizzip/js/index.js';

export function readDocx(path) {
  return new PizZip(fs.readFileSync(path));
}

export function getDocumentXml(zip) {
  return zip.file('word/document.xml').asText();
}

/** Trả về [before, bodyInner, after] — tách phần trong <w:body>. */
export function splitBody(xml) {
  const open = xml.indexOf('<w:body>');
  const close = xml.lastIndexOf('</w:body>');
  if (open < 0 || close < 0) throw new Error('Không tìm thấy <w:body>');
  return [xml.slice(0, open + '<w:body>'.length), xml.slice(open + '<w:body>'.length, close), xml.slice(close)];
}

/**
 * Quét các khối con TRỰC TIẾP của body (w:p, w:tbl, w:sectPr...) có xử lý lồng
 * nhau (w:p nằm trong w:tbl) bằng cách đếm mở/đóng cùng tên tag.
 * Trả về mảng { tag, xml, start, end }.
 */
export function scanBlocks(bodyInner) {
  const blocks = [];
  let i = 0;
  while (i < bodyInner.length) {
    const lt = bodyInner.indexOf('<', i);
    if (lt < 0) break;
    const m = /^<(w:[A-Za-z]+)([\s>/])/.exec(bodyInner.slice(lt, lt + 40));
    if (!m) { i = lt + 1; continue; }
    const tag = m[1];
    // Thẻ tự đóng <w:x .../>
    const gt = bodyInner.indexOf('>', lt);
    if (gt < 0) break;
    if (bodyInner[gt - 1] === '/') {
      blocks.push({ tag, xml: bodyInner.slice(lt, gt + 1), start: lt, end: gt + 1 });
      i = gt + 1;
      continue;
    }
    // Tìm thẻ đóng khớp, đếm lồng nhau
    const openRe = new RegExp(`<${tag}(?=[\\s>/])`, 'g');
    const closeTag = `</${tag}>`;
    let depth = 0;
    let cursor = lt;
    let endIdx = -1;
    while (cursor < bodyInner.length) {
      openRe.lastIndex = cursor;
      const nextOpen = openRe.exec(bodyInner);
      const nextClose = bodyInner.indexOf(closeTag, cursor);
      if (nextClose < 0) break;
      if (nextOpen && nextOpen.index < nextClose) {
        // bỏ qua thẻ tự đóng
        const og = bodyInner.indexOf('>', nextOpen.index);
        if (bodyInner[og - 1] !== '/') depth++;
        cursor = og + 1;
      } else {
        depth--;
        cursor = nextClose + closeTag.length;
        if (depth === 0) { endIdx = cursor; break; }
      }
    }
    if (endIdx < 0) break;
    blocks.push({ tag, xml: bodyInner.slice(lt, endIdx), start: lt, end: endIdx });
    i = endIdx;
  }
  return blocks;
}

/** Text thuần của một khối XML (nối mọi <w:t>). */
export function blockText(xml) {
  const parts = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) parts.push(decode(m[1]));
  return parts.join('');
}

export function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function encode(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Ghi file .docx mới: clone zip gốc rồi thay word/document.xml. */
export function writeDocx(srcZip, newDocumentXml, outPath) {
  const zip = new PizZip();
  for (const relativePath of Object.keys(srcZip.files)) {
    const f = srcZip.files[relativePath];
    if (f.dir) continue;
    if (relativePath === 'word/document.xml') continue;
    zip.file(relativePath, f.asUint8Array());
  }
  zip.file('word/document.xml', newDocumentXml);
  fs.writeFileSync(outPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
