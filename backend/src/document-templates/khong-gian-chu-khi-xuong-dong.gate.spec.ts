import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';

/**
 * Cổng: khối nhiều dòng trên bản in KHÔNG được bị giãn chữ.
 *
 * ── Triệu chứng anh báo 09/09/2026 ──
 *
 *   Kính gửi:
 *   -        Ban       chỉ      huy      PC02;      ← giãn hết bề ngang
 *   - Ban chỉ huy Tổ công tác Số 1.                 ← dòng cuối thì bình thường
 *
 * ── Nguyên nhân ──
 *
 * Bộ render đổi mỗi `\n` thành ngắt dòng mềm `<w:br/>` trong CÙNG một đoạn. Word CĂN ĐỀU mọi
 * dòng kết thúc bằng ngắt thủ công và chỉ chừa dòng cuối đoạn — nên dòng ngắn bị kéo giãn từ
 * mép trái sang mép phải. Bề rộng ô không cứu được: nó giãn tới hết bề rộng có sẵn.
 *
 * Hai tầng phải cùng đúng, cổng canh cả hai:
 *
 *   1. Đoạn chứa khối phải căn TRÁI. Đây là danh sách gạch đầu dòng, căn đều là sai thể thức.
 *   2. Tệp phải bật `doNotExpandShiftReturn` — cờ tương thích của chuẩn OOXML tắt hẳn việc giãn
 *      dòng kết thúc bằng ngắt thủ công. Cần cả tầng này vì các đoạn thân bài (Nội dung, Nhận
 *      thấy, Đề xuất) CỐ Ý căn đều mà vẫn có thể nhận giá trị nhiều dòng.
 */
const THU_MUC = path.join(__dirname, '../../prisma/seed-assets/petition-docx');

/** Biến nhận giá trị NHIỀU DÒNG — chỗ duy nhất ngắt dòng mềm xuất hiện. */
const BIEN_NHIEU_DONG = new Set(['{noiNhan}', '{noiNhanThongBao}', '{noiNhanNguonTin}', '{kinhGui}']);

const tep = fs.readdirSync(THU_MUC).filter((f) => f.endsWith('.docx')).sort();

function doc(ten: string, phan: string): string {
  const f = new PizZip(fs.readFileSync(path.join(THU_MUC, ten))).file(phan);
  return f ? f.asText() : '';
}

function chuTrongDoan(doan: string): string {
  return doan
    .match(/<w:t[^>]*>(.*?)<\/w:t>/g)
    ?.map((t) => t.replace(/<[^>]+>/g, ''))
    .join('')
    .trim() ?? '';
}

describe('cổng: bản in không bị giãn chữ ở khối nhiều dòng', () => {
  it('có mẫu để canh — cổng phải thật sự chạy trên tệp', () => {
    expect(tep.length).toBeGreaterThanOrEqual(7);
  });

  it.each(tep)('%s — bật doNotExpandShiftReturn', (ten) => {
    expect(doc(ten, 'word/settings.xml')).toContain('doNotExpandShiftReturn');
  });

  it.each(tep)('%s — khối nhiều dòng căn TRÁI, không căn đều', (ten) => {
    const xml = doc(ten, 'word/document.xml');
    const xau: string[] = [];
    for (const doan of xml.match(/<w:p\b[^>]*?(?<!\/)>[\s\S]*?<\/w:p>/g) ?? []) {
      if (!BIEN_NHIEU_DONG.has(chuTrongDoan(doan))) continue;
      const ppr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(doan)?.[0] ?? '';
      if (/w:jc w:val="(both|distribute)"/.test(ppr)) xau.push(`${chuTrongDoan(doan)}: căn đều`);
      if (ppr.includes('firstLine')) xau.push(`${chuTrongDoan(doan)}: thụt đầu dòng`);
    }
    expect(xau).toEqual([]);
  });
});
