import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import { TRANG_THAI_KET_THUC } from './trang-thai-ket-thuc';

/**
 * Hễ ghi `status` vào cơ sở dữ liệu thì phải đóng MỐC GIẢI QUYẾT cùng lúc.
 *
 * ── Vì sao có cổng này ──
 *
 * Bản vá đầu chỉ nối ba chỗ ghi của Vụ việc rồi tuyên bố "đã nối đường ghi". Codex bắt: đường
 * ghi của Vụ án và Đơn thư vẫn chỉ ghi `status`, nên hồ sơ giải quyết sau đợt này KHÔNG vào kỳ
 * nào — báo cáo lại ra 0, đúng thứ vừa đi sửa, chỉ khác nguyên nhân.
 *
 * Đây là lớp lỗi "vá theo chỗ": có 20+ nơi gọi `.update()` trên ba bảng ấy, và mỗi lần thêm một
 * luồng nghiệp vụ mới là một cơ hội quên. Không ai nhớ được một luật chỉ áp dụng cho vài dòng
 * trong hai chục nghìn dòng.
 *
 * ── Cổng đọc gì ──
 *
 * Quét mọi tệp service của ba thực thể, tìm khối `data:` có ghi `status` (KHÔNG phải `select`,
 * không phải so sánh), rồi đòi khối ấy nhắc `machMocGiaiQuyet`.
 */

const GOC = resolve(__dirname, '../../..');
const NL = String.fromCharCode(10);

/** Chỗ ghi `status` KHÔNG cần đóng mốc, kèm lý do. Danh sách phải ngắn. */
/**
 * Miễn trừ được SUY TỪ CHÍNH ĐỊNH NGHĨA, không viết tay.
 *
 * Bản trước liệt kê tay: `TIEP_NHAN`, `MOI_TIEP_NHAN`, `DA_CHUYEN_VU_VIEC`, `DA_CHUYEN_VU_AN`,
 * `DANG_XAC_MINH`. Rồi định nghĩa "kết thúc" được hợp nhất và hai trạng thái `DA_CHUYEN_*` trở
 * thành KẾT THÚC — nhưng danh sách miễn trừ vẫn giữ chúng, nên cổng lặng lẽ tha đúng những chỗ
 * ghi cần canh nhất. Codex bắt.
 *
 * Một danh sách miễn trừ viết tay là bản sao thứ hai của cùng một tri thức, và bản sao thì lệch.
 * Nay cổng tự tính: chỉ tha khối ghi mà MỌI trạng thái nhắc tới đều KHÔNG phải trạng thái kết
 * thúc — tức khối ấy không thể nào tạo ra một mốc sai.
 */
const MOI_TRANG_THAI_KET_THUC = new Set<string>([
  ...TRANG_THAI_KET_THUC.case,
  ...TRANG_THAI_KET_THUC.incident,
  ...TRANG_THAI_KET_THUC.petition,
]);

/** Khối ghi có thể đặt hồ sơ vào một trạng thái kết thúc không? */
function coTheKetThuc(khoi: string): boolean {
  // `status: dto.status` / `status: existing.status` — giá trị chạy mới biết, phải canh.
  if (/status:\s*[a-z_$][\w$]*\./.test(khoi)) return true;
  return [...MOI_TRANG_THAI_KET_THUC].some((t) => khoi.includes(t));
}

function tepService(): string[] {
  const ra = execFileSync('git', ['ls-files', 'src/cases', 'src/incidents', 'src/petitions'], {
    cwd: GOC,
    encoding: 'utf8',
  });
  return ra
    .split(NL)
    .map((d) => d.trim())
    .filter((d) => d.endsWith('.service.ts') && !d.includes('.spec.'));
}

/**
 * Cắt lấy đúng các lệnh GHI VÀO BA BẢNG ấy.
 *
 * Bản đầu quét mọi khối `data: {` và bắt nhầm bản ghi NHẬT KÝ — chúng cũng chép `status` của
 * hồ sơ vào để lưu vết. Cổng kêu vì những dòng vốn đúng là cổng sẽ bị tắt.
 */
function lenhGhiThucThe(ma: string): string[] {
  const ra: string[] = [];
  // KHÔNG neo vào `prisma.`: trong giao dịch, bộ khách tên là `tx` (`tx.petition.update(...)`).
  // Bản đầu neo vào `prisma.` nên bỏ sót đúng hai đường CHUYỂN ĐỔI nằm trong giao dịch.
  for (const bang of ['case', 'incident', 'petition']) {
    for (const phep of ['update', 'create', 'updateMany']) {
      const moc = `.${bang}.${phep}(`;
      let i = ma.indexOf(moc);
      while (i !== -1) {
        let k = i + moc.length;
        let sau = 1;
        while (k < ma.length && sau > 0) {
          if (ma[k] === '(') sau++;
          else if (ma[k] === ')') sau--;
          k++;
        }
        ra.push(ma.slice(i, k));
        i = ma.indexOf(moc, k);
      }
    }
  }
  return ra;
}

/**
 * Lần theo BIẾN khi `data:` không viết thẳng.
 *
 * Đường ghi chính của Vụ án và Đơn thư dựng payload ra một biến (`const updateData = {…}`) rồi
 * truyền `data: updateData`. Bản đầu của cổng chỉ đọc chữ trong lời gọi, nên nó MÙ đúng chỗ
 * Codex vừa bắt — gieo lỗi vào đấy mà cổng vẫn xanh.
 *
 * Bài học không phải "regex chưa đủ chặt" mà là: cổng nào cũng phải gieo lỗi vào ĐÚNG đường mà
 * nó có nhiệm vụ canh, không phải vào một đường dễ gieo.
 */
function khaiBaoBien(ma: string, ten: string): string {
  for (const mo of [`const ${ten} = {`, `const ${ten}: `]) {
    const i = ma.indexOf(mo);
    if (i === -1) continue;
    const dau = ma.indexOf('{', i);
    if (dau === -1) continue;
    let k = dau + 1;
    let sau = 1;
    while (k < ma.length && sau > 0) {
      if (ma[k] === '{') sau++;
      else if (ma[k] === '}') sau--;
      k++;
    }
    return ma.slice(dau, k);
  }
  return '';
}

/** Nội dung `data:` của một lời gọi — viết thẳng hoặc qua biến. */
function noiDungData(lenh: string, maCaTep: string): string {
  const m = /data:\s*([A-Za-z_$][\w$]*)\s*[,)]/.exec(lenh);
  if (m) return khaiBaoBien(maCaTep, m[1]);
  const i = lenh.indexOf('data: {');
  if (i === -1) return '';
  let k = i + 'data: {'.length;
  let sau = 1;
  while (k < lenh.length && sau > 0) {
    if (lenh[k] === '{') sau++;
    else if (lenh[k] === '}') sau--;
    k++;
  }
  return lenh.slice(i, k);
}

describe('Ghi trạng thái thì phải đóng mốc giải quyết', () => {
  it('không khối data nào ghi status mà quên machMocGiaiQuyet', () => {
    const pham: string[] = [];
    for (const tep of tepService()) {
      const ma = readFileSync(resolve(GOC, tep), 'utf8');
      for (const lenh of lenhGhiThucThe(ma)) {
        const khoi = noiDungData(lenh, ma);
        // Chỉ quan tâm khối có GHI status (`status: X`), bỏ `status: true` của `select`.
        if (!/status:\s*[A-Za-z'"]/.test(khoi)) continue;
        if (/status:\s*true/.test(khoi)) continue;
        if (!coTheKetThuc(khoi)) continue;
        if (khoi.includes('machMocGiaiQuyet')) continue;
        pham.push(`${tep}: ${khoi.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    expect(pham).toEqual([]);
  });

  it('cổng thật sự quét được tệp — không im vì không tìm thấy gì', () => {
    expect(tepService().length).toBeGreaterThanOrEqual(3);
  });
});
