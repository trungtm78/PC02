import PizZip from 'pizzip';

/** Áp transform chuẩn hóa lên 1 chuỗi XML part (document/header/footer). */
/**
 * Gộp các run của MỘT đoạn thành một run khi đoạn ấy chứa placeholder bị cắt.
 *
 * Word cắt một chuỗi thành nhiều run mỗi khi định dạng đổi — bôi đậm nửa chữ, hay bộ kiểm
 * chính tả chen vào. Placeholder `{ten_bien}` khi ấy nằm rải ở ba bốn run với `rPr` khác
 * nhau, và bước gộp đơn giản (chỉ gộp run KHÔNG có `rPr`) không đụng tới được.
 *
 * Cả 11 mẫu in của hệ cũ đều vỡ kiểu này: dò biến ra tên rác dài hàng trăm ký tự lẫn nguyên
 * thẻ XML, tức không mẫu nào dùng được. Đây là bước PhpWord của hệ cũ gọi "fixBrokenMacros".
 *
 * Chỉ đụng đoạn CÓ placeholder vỡ, giữ `rPr` của run đầu — đoạn văn xuôi bình thường giữ
 * nguyên từng run, không mất định dạng người soạn đã đặt.
 */
function gopRunTrongDoanVo(xml: string): string {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (doan) => {
    const runs = doan.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g);
    if (!runs || runs.length < 2) return doan;

    const chu = runs.map((r) =>
      (r.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) ?? [])
        .map((t) => t.replace(/<[^>]+>/g, ""))
        .join(""),
    );
    const toanBo = chu.join("");
    // Không có placeholder, hoặc mọi placeholder đã nằm gọn trong một run → không đụng.
    if (!/\{[^{}]*\}/.test(toanBo)) return doan;
    if (runs.every((_r, i) => !/[{}]/.test(chu[i]) || /\{[^{}]*\}/.test(chu[i]))) return doan;

    const rPr = runs[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    const dauDoan = doan.slice(0, doan.indexOf(runs[0]));
    const cuoi = runs[runs.length - 1];
    const cuoiDoan = doan.slice(doan.lastIndexOf(cuoi) + cuoi.length);
    const esc = toanBo.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
    return `${dauDoan}<w:r>${rPr}<w:t xml:space="preserve">${esc}</w:t></w:r>${cuoiDoan}`;
  });
}

function normalizeXml(xml: string): string {
  const b1 = xml
    .replace(/<w:proofErr\b[^>]*\/>/g, '')
    .replace(/<w:noProof\b[^>]*\/>/g, '')
    // Gộp run text liền nhau khi run thứ hai KHÔNG có rPr: bỏ ranh giới
    // `</w:t></w:r> <w:r> <w:t…>` → 2 đoạn text nối liền trong 1 run.
    .replace(/<\/w:t><\/w:r>\s*<w:r>\s*<w:t[^>]*>/g, '');
  return gopRunTrongDoanVo(b1);
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
