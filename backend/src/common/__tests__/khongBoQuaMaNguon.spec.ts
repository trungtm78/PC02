import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Không tệp mã nguồn nào được nằm trong danh sách bỏ qua của git.
 *
 * ── Vì sao có cổng này ──
 *
 * `backend/.gitignore` từng có dòng `reports/`. Không neo dấu `/` ở đầu nghĩa là khớp MỌI thư
 * mục tên `reports` ở mọi độ sâu — kể cả `src/reports/`, tức toàn bộ mã nguồn module báo cáo.
 *
 * Hậu quả không phải là một cảnh báo: `git add backend/src` bỏ qua thư mục mới KHÔNG MỘT LỜI,
 * `git commit` báo thành công, và mọi ca kiểm ở máy vẫn xanh vì tệp còn nằm trên đĩa. Chỉ khi
 * CI dựng từ bản sao sạch mới đổ — hoặc tệ hơn, chỉ khi người khác kéo nhánh về.
 *
 * Đây đúng lớp "khe hở giữa bộ nạp và bộ đọc": máy mình đọc ĐĨA, CI đọc KHO, hai bên khác nhau
 * mà không ai báo. Cổng này bắc cầu bằng cách hỏi CHÍNH GIT.
 *
 * ── Vì sao không sửa bằng cách nhớ ──
 *
 * Luật ấy nằm yên nhiều tháng và chỉ lộ ra khi có người tạo thư mục con ĐẦU TIÊN dưới
 * `src/reports/`. Không ai nhớ được một cái bẫy chỉ bật một lần trong nhiều tháng.
 */

const GOC = resolve(__dirname, '../../../..');

/**
 * Tệp CỐ Ý bỏ qua, khai ở đây kèm lý do. Danh sách phải ngắn, và mỗi dòng phải trả lời được
 * câu "vì sao mã nguồn này không vào kho".
 */
const CO_Y_BO_QUA = [
  // Kịch bản cấp tài khoản hàng loạt cho Đội 2 — mang dữ liệu định danh cán bộ thật.
  'backend/src/legacy-migration/cli/provision-doi2-accounts.ts',
];

const XUONG_DONG = String.fromCharCode(10);

function maNguonBiBoQua(): string[] {
  const ra = execFileSync(
    'git',
    ['ls-files', '--others', '--ignored', '--exclude-standard', 'backend/src', 'frontend/src'],
    { cwd: GOC, encoding: 'utf8' },
  );
  return ra
    .split(XUONG_DONG)
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => /\.(ts|tsx|js|jsx)$/.test(d))
    .filter((d) => !CO_Y_BO_QUA.includes(d));
}

describe('Danh sách bỏ qua của git không được nuốt mã nguồn', () => {
  it('không tệp .ts/.tsx nào dưới src/ bị git bỏ qua', () => {
    expect(maNguonBiBoQua()).toEqual([]);
  });

  /**
   * Chặn NGUYÊN NHÂN, không đợi triệu chứng.
   *
   * Luật ở đây KHÔNG phải "mọi luật thư mục đều phải neo gốc" — `node_modules/`, `dist/`,
   * `coverage/` cố ý khớp mọi độ sâu, và bắt chúng neo gốc là làm cổng kêu inh ỏi vì những
   * dòng vốn đúng. Cổng ồn là cổng sẽ bị tắt.
   *
   * Luật hẹp và đúng chỗ: một luật bỏ qua không neo gốc mà TRÙNG TÊN với một thư mục có thật
   * dưới `src/` là quả mìn hẹn giờ — nó chưa nổ chỉ vì thư mục ấy chưa có tệp mới nào.
   */
  it('không luật bỏ qua nào trùng tên với thư mục dưới src/', () => {
    const tenTrongSrc = new Set<string>();
    for (const goc of ['backend/src', 'frontend/src']) {
      const ra = execFileSync('git', ['ls-files', goc], { cwd: GOC, encoding: 'utf8' });
      for (const d of ra.split(XUONG_DONG)) {
        for (const phan of d.split('/').slice(2, -1)) tenTrongSrc.add(phan);
      }
    }

    const viPham: string[] = [];
    for (const tep of ['.gitignore', 'backend/.gitignore', 'frontend/.gitignore']) {
      let noiDung: string;
      try {
        noiDung = readFileSync(resolve(GOC, tep), 'utf8');
      } catch {
        continue;
      }
      for (const dong of noiDung.split(XUONG_DONG)) {
        const l = dong.trim();
        if (!l || l.startsWith('#') || l.startsWith('!')) continue;
        if (!l.endsWith('/') || l.startsWith('/') || l.indexOf('/') !== l.length - 1) continue;
        const ten = l.slice(0, -1);
        if (tenTrongSrc.has(ten)) viPham.push(`${tep}: ${l} — trùng tên thư mục trong src/`);
      }
    }
    expect(viPham).toEqual([]);
  });
});
