import PizZip from 'pizzip';

/**
 * Đổi lần xuống dòng TRONG DỮ LIỆU thành ĐOẠN WORD mới, đúng như hệ cũ in ra.
 *
 * ── Đo được gì trên bản in thật ──
 *
 * 09/09/2026, bốn mẫu `HE_CU_VU_AN` · `HE_CU_UY_THAC` · `HE_CU_TRAO_DOI` · `HE_CU_TRA_HO_SO`,
 * mỗi mẫu một hồ sơ thật, tải thẳng từ hệ cũ: ô nhiều dòng ra thành nhiều `<w:p>`. Dòng ĐẦU
 * giữ nguyên thuộc tính đoạn của mẫu (mỗi mẫu một khác: `firstLine` 706, 709, 720…), còn mỗi
 * dòng SAU mang đúng MỘT bộ thuộc tính, giống hệt nhau ở cả bốn mẫu.
 *
 * Hệ mới trước đây dùng `linebreaks: true` của docxtemplater, tức `<w:br/>` — ngắt dòng mềm.
 * Chữ giống hệt nhau nên phép so chữ mãi mãi không thấy; báo cáo 28/08 xếp là "trình bày,
 * không phải dữ liệu" rồi bỏ qua. Chạm 15.338 hồ sơ có tóm tắt nhiều dòng và 6.259 hồ sơ có
 * nhận xét nhiều dòng.
 *
 * ── Vì sao dùng DẤU RIÊNG chứ không đi tìm `<w:br/>` ──
 *
 * Sau khi dựng xong, `<w:br/>` do dữ liệu sinh ra và `<w:br/>` do chính mẫu viết trông y hệt
 * nhau. Đổi hết là sửa cả những chỗ người soạn mẫu cố ý xuống dòng. Nên chỗ xuống dòng của dữ
 * liệu được đánh dấu TRƯỚC khi dựng, và chỉ dấu ấy mới thành đoạn.
 */

/** Dấu đánh chỗ xuống dòng của dữ liệu. Ký tự vùng dùng riêng — không có trong văn bản thật. */
export const DAU_NGAT_DOAN = '\uE000';

/** Dấu đánh chỗ xuống dòng MỀM (`<w:br/>`), giữ nguyên trong cùng một đoạn. */
export const DAU_NGAT_MEM = '\uE001';

/** Thuộc tính đoạn của các dòng SAU dòng đầu — chép từ bản in hệ cũ, không tự nghĩ ra. */
export const PPR_DONG_TIEP =
  '<w:spacing w:before="60"/><w:ind w:firstLine="709"/><w:jc w:val="both"/>';

/**
 * Những ô hệ cũ dựng bằng NGẮT DÒNG MỀM chứ không tách đoạn.
 *
 * Đo trên bản in thật ngày 09/09/2026, bốn hồ sơ 18 · 27 · 65 · 96 (mẫu `tra_ho_so_mau`):
 * `de_xuat` ra `<w:br/>` trong cùng một đoạn, trong khi `nhan_xet` và `tom_tat_noi_dung` của
 * chính những hồ sơ ấy ra mỗi dòng một ĐOẠN. Chỉ 498/55.514 hồ sơ có `de_xuat` nhiều dòng.
 *
 * Danh sách HẸP có chủ ý: chỉ ghi ô đã ĐO thấy, không suy rộng ra ô chưa kiểm.
 */
const O_NGAT_MEM = new Set(['de_xuat']);

/** Đánh dấu chỗ xuống dòng trong dữ liệu, trước khi đưa vào engine dựng. */
export function danhDauXuongDong(data: Record<string, string>): Record<string, string> {
  const ra: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    // Xuống dòng ở CUỐI giá trị bị BỎ: `de_xuat` của hồ sơ 18 kết thúc bằng ba lần xuống
    // dòng mà bản in hệ cũ không có đoạn trống nào ở đó.
    if (typeof v !== 'string') {
      ra[k] = v;
      continue;
    }
    const dau = O_NGAT_MEM.has(k) ? DAU_NGAT_MEM : DAU_NGAT_DOAN;
    ra[k] = v.replace(/[\r\n]+$/, '').replace(/\r\n|[\r\n]/g, dau);
  }
  return ra;
}


/**
 * Bỏ cỡ chữ và các cờ đậm khỏi `rPr` của DÒNG TIẾP.
 *
 * Đo trên bản in thật của hệ cũ 09/09/2026: dòng đầu của `uy_thac_dieu_tra_mau.docx` (hồ sơ
 * 69122) mang `bCs sz=28 szCs=28`, còn mỗi dòng tiếp chỉ mang `szCs=28 lang=en-US` — hệ cũ BỎ
 * `sz` và cờ đậm khi sinh dòng tiếp. Chép nguyên `rPr` của dòng đầu thì với mẫu ấy (cỡ mặc định
 * của tài liệu là 24) các dòng tiếp in ra 14pt thay vì 12pt: 13 chỗ lệch trên một hồ sơ.
 *
 * `szCs` (cỡ cho chữ phức hợp) GIỮ nguyên — hệ cũ giữ, và nó không đổi cỡ chữ tiếng Việt.
 */
function boCoDamVaCoChu(rPr: string): string {
  const con = rPr
    .replace(/<w:sz w:val="[^"]*"\s*\/>/g, '')
    .replace(/<w:b\s*\/>/g, '')
    .replace(/<w:bCs\s*\/>/g, '');
  return /<w:rPr>\s*<\/w:rPr>/.test(con) ? '' : con;
}

/** `<w:rPr>` của run đang chứa vị trí `viTri` — để dòng sau giữ nguyên kiểu chữ của dòng trước. */
function rPrCuaRun(xml: string, viTri: number): string {
  const dau = xml.lastIndexOf('<w:r>', viTri);
  const dauCoThuocTinh = xml.lastIndexOf('<w:r ', viTri);
  const batDau = Math.max(dau, dauCoThuocTinh);
  if (batDau < 0) return '';
  const doan = xml.slice(batDau, viTri);
  const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(doan)?.[0] ?? '';
  return boCoDamVaCoChu(rPr);
}

/**
 * Tách đoạn tại mỗi dấu ngắt.
 *
 * Mỗi dấu biến thành: đóng ô chữ + đóng run + đóng đoạn, rồi mở đoạn mới mang `PPR_DONG_TIEP`
 * và mở lại run với đúng `<w:rPr>` cũ. Phần đuôi của đoạn gốc tự khép lại đoạn cuối cùng, nên
 * cấu trúc vẫn cân — và dòng đầu giữ nguyên thuộc tính đoạn của mẫu vì thẻ `<w:p>` mở đầu
 * không bị đụng tới.
 */
export function ngatDoanNhuHeCu(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer);
  const tep = zip.files['word/document.xml'];
  const xml = tep?.asText() ?? '';
  if (!xml.includes(DAU_NGAT_DOAN) && !xml.includes(DAU_NGAT_MEM)) return buffer;

  let ra = '';
  let tu = 0;
  for (;;) {
    const viDoan = xml.indexOf(DAU_NGAT_DOAN, tu);
    const viMem = xml.indexOf(DAU_NGAT_MEM, tu);
    if (viDoan < 0 && viMem < 0) break;
    const laDoan = viMem < 0 || (viDoan >= 0 && viDoan < viMem);
    const viTri = laDoan ? viDoan : viMem;

    if (laDoan) {
      const rPr = rPrCuaRun(xml, viTri);
      ra +=
        xml.slice(tu, viTri) +
        `</w:t></w:r></w:p><w:p><w:pPr>${PPR_DONG_TIEP}</w:pPr><w:r>${rPr}` +
        '<w:t xml:space="preserve">';
    } else {
      // Ngắt dòng mềm nằm TRONG chính run ấy: đóng ô chữ, chèn `<w:br/>`, mở lại ô chữ. Không
      // đụng tới đoạn, nên thụt đầu dòng và căn lề của đoạn giữ nguyên.
      ra += `${xml.slice(tu, viTri)}</w:t><w:br/><w:t xml:space="preserve">`;
    }
    tu = viTri + (laDoan ? DAU_NGAT_DOAN.length : DAU_NGAT_MEM.length);
  }
  ra += xml.slice(tu);

  zip.file('word/document.xml', ra);
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}
