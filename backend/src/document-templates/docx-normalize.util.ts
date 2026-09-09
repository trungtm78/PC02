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
/** Run chỉ chứa chữ — không tab, không xuống dòng, không hình, không trường động. */
function runThuanChu(run: string): boolean {
  return !/<w:(tab|br|drawing|object|pict|fldChar|instrText|sym|noBreakHyphen)\b/.test(run);
}

/** Chữ của một run. */
function chuCuaRun(run: string): string {
  return (run.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join("");
}

/**
 * Placeholder trong một chuỗi, theo CẢ HAI cặp đang dùng: `{…}` của mẫu hệ mới và `${…}` của
 * mẫu hệ cũ (PhpWord). Chỉ xét `{…}` thì Word cắt đúng giữa `$` và `{` sẽ lọt: run sau chứa
 * `{stt}` trông đã trọn vẹn nên bước gộp bỏ qua, mà dò theo `${` thì trượt mất biến.
 */
function cacPlaceholder(s: string): string[] {
  return (s.match(/\$?\{[^{}]*\}/g) ?? []);
}

/**
 * Gộp các run LIỀN NHAU và THUẦN CHỮ khi placeholder bị cắt ngang chúng.
 *
 * Word cắt một chuỗi thành nhiều run mỗi khi định dạng đổi — bôi đậm nửa chữ, hay bộ kiểm
 * chính tả chen vào. Placeholder khi ấy nằm rải ở ba bốn run với `rPr` khác nhau, và bước gộp
 * đơn giản (chỉ gộp run KHÔNG có `rPr`) không đụng tới được. Cả 11 mẫu in của hệ cũ đều vỡ
 * kiểu này — dò biến ra tên rác lẫn nguyên thẻ XML, tức không mẫu nào dùng được.
 *
 * Chỉ gộp trong DÃY run thuần chữ: run mang `<w:tab/>`, `<w:br/>`, hình vẽ hay trường động
 * đứng ngoài dãy và giữ nguyên. Gộp cả chúng là xoá mất tab và ngắt dòng — thứ mẫu Word dùng
 * để canh dòng ký, dòng địa chỉ — và bố cục vỡ vĩnh viễn ngay khi nạp mẫu.
 */
/**
 * Nhịp run mà một placeholder vắt qua, tính theo vị trí ký tự trong chuỗi chữ đã nối.
 *
 * Trả `null` khi placeholder nằm gọn trong một run — khi ấy không phải gộp gì.
 */
function nhipCuaPlaceholder(chu: string[], ph: string): [number, number] | null {
  const toanBo = chu.join('');
  const dau = toanBo.indexOf(ph);
  if (dau < 0) return null;
  const cuoi = dau + ph.length - 1;

  let moc = 0;
  let a = -1;
  let b = -1;
  for (let k = 0; k < chu.length; k += 1) {
    const tu = moc;
    const den = moc + chu[k].length - 1;
    if (a < 0 && dau >= tu && dau <= den) a = k;
    if (cuoi >= tu && cuoi <= den) {
      b = k;
      break;
    }
    moc = den + 1;
  }
  if (a < 0 || b < 0 || a === b) return null;
  return [a, b];
}

/** Gộp các nhịp chồng lên nhau — hai placeholder cạnh nhau có thể dùng chung một run. */
function gopNhip(nhip: [number, number][]): [number, number][] {
  const sap = [...nhip].sort((x, y) => x[0] - y[0]);
  const ra: [number, number][] = [];
  for (const [a, b] of sap) {
    const cuoi = ra[ra.length - 1];
    if (cuoi && a <= cuoi[1] + 1) cuoi[1] = Math.max(cuoi[1], b);
    else ra.push([a, b]);
  }
  return ra;
}

/**
 * Gộp các run LIỀN NHAU và THUẦN CHỮ khi placeholder bị cắt ngang chúng.
 *
 * Word cắt một chuỗi thành nhiều run mỗi khi định dạng đổi — bôi đậm nửa chữ, hay bộ kiểm
 * chính tả chen vào. Placeholder khi ấy nằm rải ở ba bốn run với `rPr` khác nhau, và bước gộp
 * đơn giản (chỉ gộp run KHÔNG có `rPr`) không đụng tới được. Cả 11 mẫu in của hệ cũ đều vỡ
 * kiểu này — dò biến ra tên rác lẫn nguyên thẻ XML, tức không mẫu nào dùng được.
 *
 * CHỈ GỘP ĐÚNG NHỊP RUN MÀ PLACEHOLDER VẮT QUA. Bản trước gộp cả dãy run thuần chữ của đoạn
 * rồi lấy `rPr` của run ĐẦU, nên trong mẫu hệ cũ — nơi đoạn mở đầu bằng nhãn ĐẬM + GẠCH CHÂN
 * ("Đề xuất:", "Nhận xét:") — cả câu bị in đậm và gạch chân, còn hệ cũ chỉ đậm mỗi nhãn. Chữ
 * giống hệt nên phép so chữ không thấy; đo trên bản in thật hồ sơ 69971 mới lộ ra.
 *
 * Chỉ gộp trong DÃY run thuần chữ: run mang `<w:tab/>`, `<w:br/>`, hình vẽ hay trường động
 * đứng ngoài dãy và giữ nguyên. Gộp cả chúng là xoá mất tab và ngắt dòng — thứ mẫu Word dùng
 * để canh dòng ký, dòng địa chỉ — và bố cục vỡ vĩnh viễn ngay khi nạp mẫu.
 */
/** `rPr` của một run, dạng chuỗi — dùng để biết hai run có CÙNG định dạng không. */
function rPrCua(run: string): string {
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? '';
}

/**
 * Gộp run liền nhau CÙNG ĐỊNH DẠNG.
 *
 * Word cắt một chuỗi thành nhiều run vì đủ thứ lý do không liên quan tới định dạng (bộ kiểm
 * chính tả, dấu vết soạn thảo). Gộp lại giúp placeholder liền mạch với MỌI cặp delimiter, kể
 * cả cặp admin tự chọn như `«»` mà bước gộp theo placeholder không biết.
 *
 * BẮT BUỘC cùng `rPr`. Bản trước gộp bất cứ khi nào run SAU trống `rPr`, nên chữ của nó thừa
 * hưởng định dạng của run trước — trong mẫu hệ cũ, giá trị sau nhãn đậm "Đề xuất:" bị in đậm
 * theo, còn hệ cũ chỉ đậm mỗi nhãn.
 */
function gopRunCungKieu(xml: string): string {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (doan) => {
    const runs = doan.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g);
    if (!runs || runs.length < 2) return doan;

    let ra = doan;
    let i = 0;
    while (i < runs.length) {
      let j = i;
      while (
        j + 1 < runs.length &&
        runThuanChu(runs[j]) &&
        runThuanChu(runs[j + 1]) &&
        rPrCua(runs[j]) === rPrCua(runs[j + 1])
      ) {
        j++;
      }
      if (j > i) {
        const day = runs.slice(i, j + 1);
        const esc = day
          .map(chuCuaRun)
          .join('')
          .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
        ra = ra.replace(
          day.join(''),
          `<w:r>${rPrCua(day[0])}<w:t xml:space="preserve">${esc}</w:t></w:r>`,
        );
      }
      i = j + 1;
    }
    return ra;
  });
}

function gopRunTrongDoanVo(xml: string): string {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (doan) => {
    const runs = doan.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g);
    if (!runs || runs.length < 2) return doan;

    let ra = doan;
    let i = 0;
    while (i < runs.length) {
      if (!runThuanChu(runs[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < runs.length && runThuanChu(runs[j + 1])) j++;
      if (j > i) {
        const day = runs.slice(i, j + 1);
        const chu = day.map(chuCuaRun);
        const nhip = cacPlaceholder(chu.join(''))
          .map((ph) => nhipCuaPlaceholder(chu, ph))
          .filter((n): n is [number, number] => n !== null);

        // Gộp từ CUỐI về ĐẦU để chỉ số của những nhịp chưa xử lý không bị lệch.
        for (const [a, b] of gopNhip(nhip).reverse()) {
          const phan = day.slice(a, b + 1);
          const rPr = phan[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
          const esc = phan
            .map(chuCuaRun)
            .join('')
            .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
          ra = ra.replace(phan.join(''), `<w:r>${rPr}<w:t xml:space="preserve">${esc}</w:t></w:r>`);
        }
      }
      i = j + 1;
    }
    return ra;
  });
}

function normalizeXml(xml: string): string {
  // KHÔNG còn bước "gộp mọi run mà run sau không có rPr".
  //
  // Bước ấy xoá ranh giới `</w:t></w:r><w:r><w:t>` bất cứ khi nào run sau trống `rPr`, nên chữ
  // của run sau thừa hưởng định dạng của run TRƯỚC. Trong mẫu hệ cũ, đoạn mở đầu bằng nhãn
  // ĐẬM ("Đề xuất:", "Nhận xét:") rồi tới giá trị thường — và giá trị bị in đậm theo. Phần việc
  // thật của nó (Word cắt run giữa placeholder) nay do `gopRunTrongDoanVo` làm, và làm hẹp hơn:
  // chỉ đúng nhịp run mà placeholder vắt qua.
  const b1 = xml
    .replace(/<w:proofErr\b[^>]*\/>/g, '')
    .replace(/<w:noProof\b[^>]*\/>/g, '');
  return gopRunTrongDoanVo(gopRunCungKieu(b1));
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
