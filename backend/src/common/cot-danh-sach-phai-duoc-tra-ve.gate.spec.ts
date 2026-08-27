import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi cột danh sách đọc trường nào thì truy vấn phải TRẢ VỀ trường ấy — cho CẢ BA màn.
 *
 * `getList` của ba thực thể đều dùng `select` tường minh. Cột trên màn hình đọc một trường
 * không có trong `select` thì nó luôn rỗng — không lỗi, không cảnh báo, chỉ là một cột trắng
 * mà ai nhìn cũng tưởng "dữ liệu chưa nhập".
 *
 * Đã xảy ra hai lần: "Nguồn đơn/Đơn vị giao" của Vụ việc (26/08/2026) và "Đơn vị giải quyết"
 * của Đơn thư + Vụ án (27/08/2026). Lần đầu cổng này ra đời nhưng CHỈ phủ Vụ việc, nên lần
 * thứ hai vẫn lọt.
 *
 * Đọc cả hai phía dạng văn bản: giao diện và máy chủ là hai dự án TypeScript riêng.
 */
const GOC = path.resolve(__dirname, '../..', '..');

interface Man {
  ten: string;
  service: string;
  shell: string;
  /** Trường của quan hệ hoặc suy ra ở giao diện — không nằm trong `select` phẳng. */
  ngoaiLe: readonly string[];
}

const BANG: Man[] = [
  {
    ten: 'Đơn thư',
    service: 'backend/src/petitions/petitions.service.ts',
    shell: 'frontend/src/pages/petitions/PetitionListPageShell.tsx',
    ngoaiLe: ['enteredBy', 'assignedTo', 'linkedCase', 'linkedIncident', 'crimeChinh'],
  },
  {
    ten: 'Vụ việc',
    service: 'backend/src/incidents/incidents.service.ts',
    shell: 'frontend/src/pages/incidents/IncidentListPageShell.tsx',
    ngoaiLe: ['investigator', 'canBoNhap', 'createdBy', 'linkedCase', 'mergedInto'],
  },
  {
    ten: 'Vụ án',
    service: 'backend/src/cases/cases.service.ts',
    shell: 'frontend/src/pages/cases/CaseListPageShell.tsx',
    ngoaiLe: [
      'investigator',
      'canBoNhap',
      'createdBy',
      'linkedPetition',
      'linkedIncident',
      'crimeChinh',
      'statistic',
      'assignedTeam',
    ],
  },
];

/** Trường mà `getList` khai trong `select`. */
function truongTraVe(duong: string): Set<string> {
  const src = fs.readFileSync(duong, 'utf8');
  const i = src.indexOf('async getList(');
  if (i < 0) return new Set();
  const than = src.slice(i, src.indexOf('async ', i + 12));
  const k = than.indexOf('select:');
  if (k < 0) return new Set();
  // Cắt theo ĐỘ SÂU NGOẶC. Cắt ở `},` đầu tiên sẽ trúng một đối tượng lồng (vd
  // `investigator: { select: {...} },`) và bỏ sót phần lớn danh sách — khi ấy cổng báo thiếu
  // hàng loạt trường vẫn đang được trả về đầy đủ.
  const dau = than.indexOf('{', k);
  let sau = 0;
  let cuoi = than.length;
  for (let i = dau; i < than.length; i++) {
    if (than[i] === '{') sau++;
    else if (than[i] === '}') {
      sau--;
      if (sau === 0) {
        cuoi = i;
        break;
      }
    }
  }
  const khoi = than.slice(dau, cuoi);
  return new Set(Array.from(khoi.matchAll(/^\s*(\w+):\s*true/gm)).map((m) => m[1]));
}

/** Trường mà các cột danh sách đọc từ bản ghi (`r.<trường>`). */
function truongCotDoc(duong: string): Set<string> {
  const src = fs.readFileSync(duong, 'utf8');
  const i = src.indexOf('key: ');
  const than = src.slice(i);
  return new Set(Array.from(than.matchAll(/\br\.(\w+)\b/g)).map((m) => m[1]));
}

describe.each(BANG.map((m) => [m.ten, m] as const))(
  'GATE %s — cột danh sách đọc trường nào thì truy vấn phải trả về trường ấy',
  (_ten, man) => {
    const duongService = path.join(GOC, man.service);
    const duongShell = path.join(GOC, man.shell);
    const coDu = fs.existsSync(duongService) && fs.existsSync(duongShell);

    it('đọc được cả hai tệp', () => {
      expect(coDu).toBe(true);
    });

    it('đọc được danh sách trường, không rơi về rỗng', () => {
      if (!coDu) return;
      expect(truongTraVe(duongService).size).toBeGreaterThan(15);
      expect(truongCotDoc(duongShell).size).toBeGreaterThan(4);
    });

    it('không cột nào đọc trường mà truy vấn không trả về', () => {
      if (!coDu) return;
      const traVe = truongTraVe(duongService);
      const thieu = [...truongCotDoc(duongShell)].filter(
        (t) => !traVe.has(t) && !man.ngoaiLe.includes(t),
      );
      expect(thieu).toEqual([]);
    });
  },
);

/** Hai cột từng rỗng vì đúng lớp lỗi này — chốt lại để không tái diễn. */
describe('Hai cột từng rỗng phải nằm trong truy vấn', () => {
  it.each([
    ['Đơn thư', 'backend/src/petitions/petitions.service.ts', 'donViGiaiQuyet'],
    ['Vụ án', 'backend/src/cases/cases.service.ts', 'donViGiaiQuyet'],
    ['Vụ việc', 'backend/src/incidents/incidents.service.ts', 'chuyenTuDonVi'],
  ])('%s: truy vấn trả về đúng cột', (_ten, service, cot) => {
    expect(truongTraVe(path.join(GOC, service)).has(cot as string)).toBe(true);
  });
});
