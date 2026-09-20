import { describe, expect, it } from 'vitest';
import { gomCanBoTheoTo, NHAN_CHUA_CO_TO, NHOM_CHUA_CO_TO, NHOM_GHIM } from '../gomCanBoTheoTo';
import type { OfficerOption } from '../useOfficerOptions';

const to = (teamId: string, teamName: string, isLeader = false) => ({
  teamId,
  teamName,
  isLeader,
  laDiaBan: false,
});

const A: OfficerOption = { value: 'a', label: 'Nguyễn Văn A', teams: [to('t1', 'Tổ 1')] };
const B: OfficerOption = { value: 'b', label: 'Nguyễn Văn B', teams: [to('t1', 'Tổ 1')] };
const D: OfficerOption = { value: 'd', label: 'Trịnh Lê D', teams: [to('t1', 'Tổ 1', true)] };
const E: OfficerOption = { value: 'e', label: 'Nguyễn Văn E', teams: [to('t2', 'Tổ 2')] };
const G: OfficerOption = { value: 'g', label: 'Lê Thị G', teams: [] };
const HAI_TO: OfficerOption = {
  value: 'h',
  label: 'Phạm Hai Tổ',
  teams: [to('t2', 'Tổ 2'), to('t1', 'Tổ 1')],
};

describe('gomCanBoTheoTo', () => {
  it('gom theo tổ, tổ sắp theo tên', () => {
    const nhom = gomCanBoTheoTo([E, A, B]);
    expect(nhom.map((n) => n.label)).toEqual(['Tổ 1', 'Tổ 2']);
    expect(nhom[0].options.map((m) => m.value)).toEqual(['a', 'b']);
  });

  it('tổ trưởng xếp đầu nhóm — đó là lý do giữ `isLeader` từ máy chủ', () => {
    expect(gomCanBoTheoTo([A, B, D])[0].options.map((m) => m.value)).toEqual(['d', 'a', 'b']);
  });

  it('cán bộ thuộc HAI tổ hiện ở CẢ HAI nhóm', () => {
    const nhom = gomCanBoTheoTo([A, E, HAI_TO]);
    expect(nhom.find((n) => n.label === 'Tổ 1')?.options.map((m) => m.value)).toContain('h');
    expect(nhom.find((n) => n.label === 'Tổ 2')?.options.map((m) => m.value)).toContain('h');
  });

  it('người không thuộc tổ nào vào nhóm "Chưa có tổ", luôn ở CUỐI', () => {
    const nhom = gomCanBoTheoTo([G, E, A]);
    expect(nhom[nhom.length - 1].key).toBe(NHOM_CHUA_CO_TO);
    expect(nhom[nhom.length - 1].label).toBe(NHAN_CHUA_CO_TO);
    expect(nhom[nhom.length - 1].options.map((m) => m.value)).toEqual(['g']);
  });

  it('không ai thiếu tổ thì KHÔNG dựng nhóm rỗng', () => {
    expect(gomCanBoTheoTo([A, E]).some((n) => n.key === NHOM_CHUA_CO_TO)).toBe(false);
  });

  it('danh sách rỗng ra mảng rỗng, không nổ', () => {
    expect(gomCanBoTheoTo([])).toEqual([]);
  });

  it('không làm mất ai: tổng số chỗ ngồi ≥ số người', () => {
    const ds = [A, B, D, E, G, HAI_TO];
    const tongCho = gomCanBoTheoTo(ds).reduce((s, n) => s + n.options.length, 0);
    expect(tongCho).toBe(7); // 6 người, `h` ngồi hai chỗ
    const moiNguoi = new Set(gomCanBoTheoTo(ds).flatMap((n) => n.options.map((m) => m.value)));
    expect(moiNguoi.size).toBe(ds.length);
  });
});

/**
 * Tên tổ THẬT trên bản chạy (`backend/tmp-teams.txt`) có số hai chữ số. So chuỗi thuần xếp
 * "Tổ CT số 10" trước "Tổ CT số 4" — cán bộ tìm tổ mình phải quét cả danh sách.
 *
 * Ca kiểm cũ chỉ dùng "Tổ 1"/"Tổ 2" nên không bao giờ bắt được.
 */
describe('gomCanBoTheoTo — thứ tự tổ trên TÊN THẬT', () => {
  const nguoi = (id: string, teamId: string, teamName: string): OfficerOption => ({
    value: id,
    label: id,
    teams: [{ teamId, teamName, isLeader: false, laDiaBan: false }],
  });

  it('xếp theo SỐ, không theo chuỗi: 4 · 5 · 9 · 10', () => {
    const ds = [
      nguoi('a', 'x10', 'Tổ CT số 10'),
      nguoi('b', 'x4', 'Tổ CT số 4'),
      nguoi('c', 'x9', 'Tổ CT số 9'),
      nguoi('d', 'x5', 'Tổ CT số 5'),
    ];
    expect(gomCanBoTheoTo(ds).map((n) => n.label)).toEqual([
      'Tổ CT số 4', 'Tổ CT số 5', 'Tổ CT số 9', 'Tổ CT số 10',
    ]);
  });

  it('"Chưa có tổ" vẫn ở CUỐI dù sắp theo số', () => {
    const ds = [
      nguoi('a', 'x10', 'Tổ CT số 10'),
      { value: 'z', label: 'z', teams: [] } as OfficerOption,
      nguoi('b', 'x4', 'Tổ CT số 4'),
    ];
    expect(gomCanBoTheoTo(ds).map((n) => n.label)).toEqual([
      'Tổ CT số 4', 'Tổ CT số 10', NHAN_CHUA_CO_TO,
    ]);
  });
});

/**
 * Người hồ sơ ĐANG trỏ tới mà không còn hoạt động được `giuCanBoDaChon` thêm lại với
 * `teams: []`. Nếu gom như người thường thì họ rơi vào "Chưa có tổ" ở tận ĐÁY danh sách 245
 * người — trong khi họ chính là người cần nhìn thấy ngay. Ghim đầu.
 */
describe('gomCanBoTheoTo — ghim người đang chọn', () => {
  it('ghim đầu danh sách, không rơi xuống "Chưa có tổ"', () => {
    const daNghi: OfficerOption = { value: 'x', label: 'Lê Đã Nghỉ (không còn hoạt động)', teams: [] };
    const nhom = gomCanBoTheoTo([daNghi, A, E, G], 'x');
    expect(nhom[0].key).toBe(NHOM_GHIM);
    expect(nhom[0].options.map((m) => m.value)).toEqual(['x']);
    // Người không tổ KHÁC vẫn ở cuối như cũ.
    expect(nhom[nhom.length - 1].key).toBe(NHOM_CHUA_CO_TO);
    expect(nhom[nhom.length - 1].options.map((m) => m.value)).toEqual(['g']);
  });

  it('không truyền id ghim thì hành vi y như cũ', () => {
    expect(gomCanBoTheoTo([A, E]).map((n) => n.label)).toEqual(['Tổ 1', 'Tổ 2']);
  });

  it('người ghim VẪN CÒN tổ thì để trong tổ của họ, không ghim thừa', () => {
    expect(gomCanBoTheoTo([A, E], 'a').some((n) => n.key === NHOM_GHIM)).toBe(false);
  });
});

/*
  Đo prod 20/09 — con số quyết định cách gom nhóm:

  · 241 cán bộ hoạt động, trải trên **207 tổ có người**.
  · Chỉ 2 tổ là tổ công tác thật (PC02 18 người, Tổ công tác Số 2 13 người).
  · 167 tổ còn lại là công an phường/xã, mỗi nơi ĐÚNG MỘT tài khoản.
  · Trong 47.941 đơn thư, chỉ 34 người từng được giao hoặc nhập đơn — và **không một ai**
    thuộc tổ địa bàn.

  Gom thẳng theo tổ thì ô chọn mọc ra 167 tiêu đề nhóm một người, chắn hết hai tổ thật. Đúng
  thứ yêu cầu 1 muốn dẹp.

  Cách xử lý: tổ ĐỊA BÀN gộp vào MỘT nhóm đặt gần cuối, mỗi người vẫn mang tên đơn vị mình nên
  không ai biến mất và vẫn gõ tên phường ra được. KHÔNG bỏ họ khỏi danh sách — bỏ đi là quyết
  thay anh rằng PC02 sẽ không bao giờ giao đơn cho công an phường.
*/
const diaBan = (teamId: string, teamName: string) => ({
  teamId,
  teamName,
  isLeader: false,
  laDiaBan: true,
});

const P1: OfficerOption = {
  value: 'p1',
  label: 'Trần Phường Một',
  teams: [diaBan('w1', 'Công an Phường Chợ Quán')],
};
const P2: OfficerOption = {
  value: 'p2',
  label: 'Lý Phường Hai',
  teams: [diaBan('w2', 'Công an Phường Tân Định')],
};

describe('gomCanBoTheoTo — tổ địa bàn gộp làm một nhóm', () => {
  it('167 công an phường KHÔNG đẻ ra 167 tiêu đề nhóm', () => {
    const nhom = gomCanBoTheoTo([A, P1, P2]);
    const nhanDiaBan = nhom.filter((n) => n.label.includes('phường'));
    expect(nhanDiaBan).toHaveLength(1);
    expect(nhanDiaBan[0].options.map((o) => o.value).sort()).toEqual(['p1', 'p2']);
  });

  it('nhóm địa bàn đứng SAU các tổ chức năng', () => {
    const nhom = gomCanBoTheoTo([P1, A]);
    const iChucNang = nhom.findIndex((n) => n.label === 'Tổ 1');
    const iDiaBan = nhom.findIndex((n) => n.label.includes('phường'));
    expect(iChucNang).toBeGreaterThanOrEqual(0);
    expect(iDiaBan).toBeGreaterThan(iChucNang);
  });

  it('nhóm địa bàn đứng TRƯỚC "Chưa có tổ" — chưa có tổ vẫn là đáy', () => {
    const nhom = gomCanBoTheoTo([P1, G]);
    const iDiaBan = nhom.findIndex((n) => n.label.includes('phường'));
    const iChuaCo = nhom.findIndex((n) => n.key === NHOM_CHUA_CO_TO);
    expect(iDiaBan).toBeGreaterThanOrEqual(0);
    expect(iChuaCo).toBeGreaterThan(iDiaBan);
  });

  it('mỗi người trong nhóm ấy vẫn mang TÊN ĐƠN VỊ để gõ tìm ra được', () => {
    const nhom = gomCanBoTheoTo([P1, P2]);
    const g = nhom.find((n) => n.label.includes('phường'))!;
    const nhan = g.options.map((o) => o.label);
    expect(nhan.some((l) => l.includes('Chợ Quán'))).toBe(true);
    expect(nhan.some((l) => l.includes('Tân Định'))).toBe(true);
  });

  it('KHÔNG dựng nhóm địa bàn khi không có ai — nhóm rỗng là dòng tiêu đề vô nghĩa', () => {
    const nhom = gomCanBoTheoTo([A, E]);
    expect(nhom.some((n) => n.label.includes('phường'))).toBe(false);
  });

  it('người vừa ở tổ chức năng vừa ở tổ địa bàn hiện ở CẢ HAI', () => {
    const caHai: OfficerOption = {
      value: 'x',
      label: 'Vũ Cả Hai',
      teams: [to('t1', 'Tổ 1'), diaBan('w1', 'Công an Phường Chợ Quán')],
    };
    const nhom = gomCanBoTheoTo([caHai]);
    expect(nhom.find((n) => n.label === 'Tổ 1')!.options.map((o) => o.value)).toContain('x');
    expect(
      nhom.find((n) => n.label.includes('phường'))!.options.map((o) => o.value),
    ).toContain('x');
  });

  it('người GHIM vẫn đứng đầu, không bị nhóm địa bàn chen lên', () => {
    const khoa: OfficerOption = { value: 'k', label: 'Đã khoá', teams: [] };
    const nhom = gomCanBoTheoTo([P1, khoa], 'k');
    expect(nhom[0].key).toBe(NHOM_GHIM);
  });
});
