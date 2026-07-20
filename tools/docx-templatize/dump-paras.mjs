/**
 * Dump từng <w:p> (kể cả trong bảng) kèm text — để soạn rule thay placeholder.
 * Chạy: node tools/docx-templatize/dump-paras.mjs <file.docx> [từ] [đến]
 */
import { readDocx, getDocumentXml, splitBody, scanBlocks } from './lib/docx.mjs';
import { paragraphText } from './lib/replace.mjs';

const [, , file, fromArg, toArg] = process.argv;
const zip = readDocx(file);
const [, bodyInner] = splitBody(getDocumentXml(zip));
const blocks = scanBlocks(bodyInner);
const from = fromArg ? Number(fromArg) : 0;
const to = toArg ? Number(toArg) : blocks.length - 1;

const slice = blocks.slice(from, to + 1).map((b) => b.xml).join('');
const paras = slice.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
console.log(`# khối ${from}..${to} — ${paras.length} đoạn`);
const showEmpty = process.argv.includes('--all');
paras.forEach((p, i) => {
  const t = paragraphText(p).replace(/\s+/g, ' ').trim();
  if (t) console.log(`${String(i).padStart(3)} | ${t}`);
  else if (showEmpty) console.log(`${String(i).padStart(3)} | (trống)`);
});
