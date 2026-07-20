/**
 * Phân tích cấu trúc file .docx PC01: liệt kê khối body + text để xác định
 * ranh giới từng chứng từ. Chạy: node tools/docx-templatize/analyze.mjs <file>
 */
import { readDocx, getDocumentXml, splitBody, scanBlocks, blockText } from './lib/docx.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Thiếu đường dẫn .docx');
  process.exit(1);
}

const zip = readDocx(file);
const [, bodyInner] = splitBody(getDocumentXml(zip));
const blocks = scanBlocks(bodyInner);

console.log(`Tổng khối body: ${blocks.length}`);
blocks.forEach((b, i) => {
  const t = blockText(b.xml).replace(/\s+/g, ' ').trim();
  const hasPageBreak = /w:type="page"/.test(b.xml);
  const flag = hasPageBreak ? ' [PAGEBREAK]' : '';
  if (t || hasPageBreak || b.tag !== 'w:p') {
    console.log(`${String(i).padStart(3)} ${b.tag.padEnd(8)}${flag} | ${t.slice(0, 110)}`);
  }
});
