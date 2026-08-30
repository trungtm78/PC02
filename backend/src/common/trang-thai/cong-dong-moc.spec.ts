import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';

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
const MIEN_TRU = [
  // Tạo mới: hồ sơ vừa sinh ra luôn ở trạng thái mở, không thể đã giải quyết.
  'TIEP_NHAN',
  'MOI_TIEP_NHAN',
  // Đơn thư nâng lên vụ việc/vụ án — không phải giải quyết, xem TRANG_THAI_KET_THUC.
  'DA_CHUYEN_VU_VIEC',
  'DA_CHUYEN_VU_AN',
  // Phân công điều tra viên: đổi sang trạng thái đang làm việc.
  'DANG_XAC_MINH',
];

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
  for (const bang of ['case', 'incident', 'petition']) {
    for (const phep of ['update', 'create', 'updateMany']) {
      const moc = `prisma.${bang}.${phep}(`;
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
        if (MIEN_TRU.some((t) => khoi.includes(t))) continue;
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
