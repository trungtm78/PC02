import PizZip from 'pizzip';

/**
 * Chuẩn hóa `word/document.xml` để placeholder do admin gõ (kể cả tiếng Việt có
 * dấu/khoảng trắng) nhận diện + render ổn định, chống Word tách run:
 *  1. Strip `<w:proofErr/>` / `<w:noProof/>` (Word chèn quanh từ "sai chính tả"
 *     tiếng Việt → cắt placeholder thành nhiều run).
 *  2. Gộp các run text liền nhau KHÔNG có `<w:rPr>` (run bị tách giữa tag) — chỉ
 *     gộp boundary `<w:r><w:t>` trần để KHÔNG nuốt định dạng của run khác kiểu.
 *
 * Trả về buffer mới đã chuẩn hóa; buffer hỏng / không phải zip / thiếu
 * document.xml → trả lại NGUYÊN buffer gốc (không throw).
 *
 * Lưu ý: đây là bước "best-effort" cho tag tách run đơn giản. Tag bị tách kèm
 * định dạng khác nhau giữa các run vẫn có thể vỡ → validate 2 lớp ở service sẽ
 * reject lúc upload (fallback tất định: yêu cầu admin gõ lại liền mạch).
 */
export function normalizeDocxTags(buffer: Buffer): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch {
    return buffer;
  }
  const file = zip.file('word/document.xml');
  if (!file) return buffer;

  const original = file.asText();
  const xml = original
    .replace(/<w:proofErr\b[^>]*\/>/g, '')
    .replace(/<w:noProof\b[^>]*\/>/g, '')
    // Gộp run text liền nhau khi run thứ hai KHÔNG có rPr: bỏ ranh giới
    // `</w:t></w:r> <w:r> <w:t…>` → 2 đoạn text nối liền trong 1 run.
    .replace(/<\/w:t><\/w:r>\s*<w:r>\s*<w:t[^>]*>/g, '');

  // Không có gì để chuẩn hóa → giữ NGUYÊN buffer gốc (tránh re-zip thừa, giữ sha).
  if (xml === original) return buffer;

  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' });
}
