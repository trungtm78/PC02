import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: không ô ngày nào được nhận `String(...)` trần.
 *
 * Đo 23/09/2026 bằng Playwright, cùng một trang, chỉ khác engine:
 *
 *     <input type="date" value="undefined">
 *       Chromium  →  .value === ""            (làm sạch theo đặc tả HTML)
 *       WebKit    →  .value === "undefined"   (GIỮ NGUYÊN chuỗi rác)
 *
 * WebKit là engine của Safari. Nên một chuỗi hỏng lọt vào ô ngày sẽ sống sót trên máy macOS
 * và đi lên máy chủ lúc bấm Lưu, trong khi trên Windows cùng bản dựng ấy ô chỉ hiện rỗng —
 * không ai thấy gì bất thường. Hỏng im lặng, và chỉ hỏng ở một nửa số máy.
 *
 * Ngân sách MỘT CHIỀU: 0. Thêm một chỗ là đỏ. Giảm thì sửa ngân sách xuống, và việc giảm ấy
 * là bằng chứng tiến độ.
 */
// BON cap: __tests__ -> legacy-form -> features -> src -> goc frontend.
// Ba cap chi toi `src`, roi path.join(GOC,'src') thanh `src/src` va bo do quet ra 0 tep —
// dung loai cong rong ma menh de neo ben duoi sinh ra de chan.
const GOC = path.resolve(__dirname, '..', '..', '..', '..');

/** Mọi tệp .tsx của sản phẩm (bỏ ca kiểm). */
function moiTepTsx(d: string): string[] {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : moiTepTsx(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

/**
 * Trả về các chỗ dựng ô ngày mà `value` là `String(...)` trần.
 *
 * Quét CẢ `<input>` lẫn `<FormInput>`: chỗ hở thật 23/09/2026 nằm ở `<FormInput>`, nên cổng
 * chỉ quét `<input>` sẽ xanh trong khi lỗi còn nguyên — đúng loại cổng rỗng phải tránh.
 */
function choHo(src: string): string[] {
  const ra: string[] = [];
  for (const m of src.matchAll(/<(?:input|FormInput)[\s/>]/g)) {
    // Cắt thẻ theo ĐỘ SÂU NGOẶC NHỌN, không dừng ở dấu `>` đầu tiên.
    //
    // Codex bắt 23/09/2026: biểu thức cũ cắt thẻ ngay tại dấu `>` của một hàm mũi tên, nên
    // đoạn dưới KHÔNG bị bộ dò nhìn thấy và cổng xanh trong khi lỗi còn nguyên:
    //
    //     <input type="date" onChange={(e) => f(e)} value={String(v)} />
    let sau = 0;
    let cuoi = src.length;
    for (let k = m.index as number; k < src.length; k++) {
      const c = src[k];
      if (c === '{') sau++;
      else if (c === '}') sau--;
      else if (c === '>' && sau === 0) { cuoi = k + 1; break; }
    }
    const the = src.slice(m.index as number, cuoi);
    // Bỏ dòng đã chú thích: đếm dòng bị treo cổ là đếm thứ không chạy.
    const sach = the.replace(/^\s*\/\/.*$/gm, '');
    const laNgay = /type=\{[^}]*["']date["']/.test(sach) || /type=["']date["']/.test(sach);
    if (!laNgay) continue;
    const v = /value=\{([\s\S]*?)\}\s*(?:\n|\/|>|[a-zA-Z-]+=)/.exec(sach);
    if (v && /(^|[^a-zA-Z])String\s*\(/.test(v[1])) ra.push(v[1].trim().slice(0, 70));
  }
  return ra;
}

/**
 * Mẫu BẨN dùng để tự kiểm BỘ DÒ.
 *
 * Neo vào số tệp là chưa đủ: 23/09/2026 một dấu thoát bị nuốt làm biểu thức quét thành
 * `/<(?:input|FormInput)<BS>/`, bộ dò trả 0 thẻ, và cổng vẫn xanh vì mệnh đề neo chỉ đếm tệp.
 * Đây là lần thứ TƯ trong cùng một bản vá mà cổng rỗng. Nên bộ dò phải tự chứng minh nó chạy.
 */
const MAU_BAN = [
  '<input type="date" value={String(v)} />',
  '<input type="date" onChange={(e) => f(e)} value={String(v)} />',
  '<FormInput type={k === "date" ? "date" : "text"} value={String(v)} />',
];
const MAU_SACH = [
  '<input type="date" value={giaTriONgay(v)} />',
  '<input type="text" value={String(v)} />',
];

describe('CỔNG: ô ngày không nhận String(...) trần', () => {
  const tep = moiTepTsx(path.join(GOC, 'src'));

  it.each(MAU_BAN)('BỘ DÒ tự kiểm — phải thấy mẫu bẩn: %s', (mau) => {
    expect(choHo(mau)).toHaveLength(1);
  });

  it.each(MAU_SACH)('BỘ DÒ tự kiểm — không báo nhầm mẫu sạch: %s', (mau) => {
    expect(choHo(mau)).toEqual([]);
  });

  it('quét được thật, không rơi về rỗng', () => {
    expect(tep.length).toBeGreaterThan(200);
    // Mốc: tệp CHẮC CHẮN có ô ngày phải được bộ dò nhìn thấy. Không có mệnh đề này thì một
    // biểu thức hỏng làm bộ dò trả rỗng và cổng xanh vĩnh viễn.
    const mocPath = path.join(GOC, 'src/components/legacy-form/LegacyLayoutSection.tsx');
    const moc = fs.readFileSync(mocPath, 'utf8');
    expect(/type=\{[^}]*["']date["']/.test(moc)).toBe(true);
  });

  it('0 chỗ dựng ô ngày nhận String(...) trần', () => {
    const viPham: string[] = [];
    for (const p of tep) {
      for (const bt of choHo(fs.readFileSync(p, 'utf8'))) {
        const duong = path.relative(GOC, p).split(path.sep).join('/');
        viPham.push(duong + ' -> value={' + bt + '}');
      }
    }
    expect(viPham).toEqual([]);
  });
});
