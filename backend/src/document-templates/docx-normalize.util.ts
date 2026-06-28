import PizZip from 'pizzip';

/** Áp transform chuẩn hóa lên 1 chuỗi XML part (document/header/footer). */
function normalizeXml(xml: string): string {
  return xml
    .replace(/<w:proofErr\b[^>]*\/>/g, '')
    .replace(/<w:noProof\b[^>]*\/>/g, '')
    // Gộp run text liền nhau khi run thứ hai KHÔNG có rPr: bỏ ranh giới
    // `</w:t></w:r> <w:r> <w:t…>` → 2 đoạn text nối liền trong 1 run.
    .replace(/<\/w:t><\/w:r>\s*<w:r>\s*<w:t[^>]*>/g, '');
}

/**
 * Chuẩn hóa các part văn bản của .docx (document.xml + các header/footer part)
 * để placeholder do admin gõ (kể cả tiếng Việt có dấu/khoảng trắng) nhận diện +
 * render ổn định, chống Word tách run:
 *  1. Strip `<w:proofErr/>` / `<w:noProof/>` (Word chèn quanh từ "sai chính tả"
 *     tiếng Việt → cắt placeholder thành nhiều run).
 *  2. Gộp các run text liền nhau KHÔNG có `<w:rPr>` (run bị tách giữa tag) — chỉ
 *     gộp boundary `<w:r><w:t>` trần để KHÔNG nuốt định dạng của run khác kiểu.
 *
 * Quét CẢ header/footer cho khớp phạm vi detectDocxVariables (tránh placeholder
 * đầu/chân trang bị tách run → detect ra tên rác → validate reject file hợp lệ).
 *
 * Trả về buffer mới đã chuẩn hóa; buffer hỏng / không phải zip / không có part nào
 * đổi → trả lại NGUYÊN buffer gốc (không throw).
 *
 * Lưu ý: best-effort cho tag tách run đơn giản. Tag tách kèm định dạng khác nhau
 * giữa run vẫn có thể vỡ → validate 2 lớp ở service reject lúc upload.
 */
export function normalizeDocxTags(buffer: Buffer): Buffer {
  let zip: PizZip;
  try {
    zip = new PizZip(buffer);
  } catch {
    return buffer;
  }
  const parts = Object.keys(zip.files).filter((n) =>
    /^word\/(document\.xml|header\d*\.xml|footer\d*\.xml)$/.test(n),
  );
  if (parts.length === 0) return buffer;

  let changed = false;
  for (const part of parts) {
    const original = zip.file(part)?.asText() ?? '';
    const xml = normalizeXml(original);
    if (xml !== original) {
      zip.file(part, xml);
      changed = true;
    }
  }

  // Không part nào đổi → giữ NGUYÊN buffer gốc (tránh re-zip thừa, giữ sha).
  if (!changed) return buffer;
  return zip.generate({ type: 'nodebuffer' });
}
