import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: mọi cột danh sách Vụ việc đọc trường nào thì truy vấn phải TRẢ VỀ trường ấy.
 *
 * `getList` dùng `select` tường minh. Cột trên màn hình đọc một trường không có trong `select`
 * thì nó luôn rỗng — không lỗi, không cảnh báo, chỉ là một cột trắng mà ai nhìn cũng tưởng
 * "dữ liệu chưa nhập". Đúng chuyện vừa xảy ra với "Nguồn đơn/Đơn vị giao": cột dựng xong,
 * 3.454 hồ sơ có dữ liệu, và màn hình hiện toàn dấu gạch.
 *
 * Đọc cả hai tệp dạng văn bản: giao diện và máy chủ là hai dự án TypeScript riêng.
 */
const GOC = path.resolve(__dirname, '../..', '..');
const SERVICE = path.join(GOC, 'backend/src/incidents/incidents.service.ts');
const SHELL = path.join(GOC, 'frontend/src/pages/incidents/IncidentListPageShell.tsx');

/** Trường mà `getList` khai trong `select`. */
function truongTraVe(): Set<string> {
  const src = fs.readFileSync(SERVICE, 'utf8');
  const i = src.indexOf('async getList(');
  const than = src.slice(i, src.indexOf('async ', i + 10));
  const k = than.indexOf('select:');
  const khoi = than.slice(k, than.indexOf('},', k));
  return new Set(Array.from(khoi.matchAll(/^\s*(\w+):\s*true/gm)).map((m) => m[1]));
}

/**
 * Trường mà các cột danh sách đọc từ bản ghi (`r.<trường>`).
 *
 * Bỏ qua trường của quan hệ lồng (`r.investigator?.firstName`) — chúng đi đường `include`
 * riêng, không nằm trong `select` phẳng.
 */
function truongCotDoc(): Set<string> {
  const src = fs.readFileSync(SHELL, 'utf8');
  const i = src.indexOf('key: ');
  const than = src.slice(i);
  return new Set(
    Array.from(than.matchAll(/\br\.(\w+)\b(?!\s*[?.]?\.)/g))
      .map((m) => m[1])
      .filter((t) => !/^(investigator|canBoNhap|createdBy|linkedCase|mergedInto)$/.test(t)),
  );
}

/** Trường của quan hệ hoặc suy ra ở giao diện, khai tường minh kèm lý do. */
const NGOAI_LE: Readonly<Record<string, string>> = {
  investigator: 'quan hệ — đi đường include riêng',
  canBoNhap: 'quan hệ — đi đường include riêng',
  createdBy: 'quan hệ — đi đường include riêng',
  linkedCase: 'quan hệ — đi đường include riêng',
  mergedInto: 'quan hệ — đi đường include riêng',
};

describe('GATE Vụ việc — cột danh sách đọc trường nào thì truy vấn phải trả về trường ấy', () => {
  const coDu = fs.existsSync(SERVICE) && fs.existsSync(SHELL);

  it('đọc được cả hai tệp', () => {
    expect(coDu).toBe(true);
  });

  it('đọc được danh sách trường, không rơi về rỗng', () => {
    if (!coDu) return;
    expect(truongTraVe().size).toBeGreaterThan(20);
    expect(truongCotDoc().size).toBeGreaterThan(5);
  });

  it('không cột nào đọc trường mà truy vấn không trả về', () => {
    if (!coDu) return;
    const traVe = truongTraVe();
    const thieu = [...truongCotDoc()].filter((t) => !traVe.has(t) && !(t in NGOAI_LE));
    expect(thieu).toEqual([]);
  });

  /** Cột vừa dựng phải thật sự có trong truy vấn — canh cho ca kiểm trên không xanh vô nghĩa. */
  it('cột "Nguồn đơn/Đơn vị giao" có trong truy vấn', () => {
    if (!coDu) return;
    expect(truongTraVe().has('chuyenTuDonVi')).toBe(true);
  });
});
