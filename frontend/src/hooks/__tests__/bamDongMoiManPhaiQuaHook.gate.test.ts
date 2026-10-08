/**
 * CỔNG: mọi màn danh sách có hành động khi bấm vào dòng PHẢI đi qua `useBamDong`.
 *
 * Vì sao: cấu hình admin (Cài đặt hệ thống) chỉ có tác dụng với màn đi qua hook. Một màn mới viết
 * `onRowClick={(r) => navigate(...)}` hoặc `<tr onClick={() => navigate(...)}>` trần sẽ lặng lẽ bỏ qua cấu hình,
 * bỏ qua rào bôi chọn (chép chữ) và Ctrl/⌘+bấm — đúng ba thứ ngày 08/10/2026 cần.
 *
 * Gieo lỗi (đã thử tay): thêm `onRowClick={() => 1}` vào một màn không dùng hook → ca "onRowClick" đỏ, và nêu tên tệp.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');

function duyet(dir: string, ra: string[] = []): string[] {
  for (const ten of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ten.name);
    if (ten.isDirectory()) {
      if (ten.name === '__tests__' || ten.name === 'node_modules') continue;
      duyet(p, ra);
    } else if (/\.tsx$/.test(ten.name) && !/\.(test|spec)\.tsx$/.test(ten.name)) {
      ra.push(p);
    }
  }
  return ra;
}

/**
 * Màn báo cáo / bản nháp chưa nằm trong 7 màn danh sách cấu hình được (quyết định 08/10/2026). Mỗi tên ở đây là một
 * khoản NỢ có tên: muốn thêm màn vào cấu hình thì đưa nó vào `MAN_BAM_DONG` rồi xoá khỏi danh sách này.
 */
const NGOAI_PHAM_VI = new Set(['pages/reports/OverdueRecordsPage.tsx', 'pages/reports/TdacDraftsPage.tsx']);

const TEP = duyet(SRC).map((p) => ({ ten: path.relative(SRC, p).replace(/\\/g, '/'), nd: fs.readFileSync(p, 'utf-8') }));

/** Bỏ chú thích để lời giải thích có chữ "onRowClick=" không bị tính. */
function boChuThich(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('mọi hành động bấm-vào-dòng đi qua useBamDong', () => {
  it('có màn dùng onRowClick= (cổng không rỗng)', () => {
    const dung = TEP.filter((t) => /\bonRowClick=/.test(boChuThich(t.nd)));
    expect(dung.length).toBeGreaterThanOrEqual(5);
  });

  it('onRowClick: tệp truyền cho <Table> phải gọi useBamDong', () => {
    const sai = TEP.filter((t) => /\bonRowClick=/.test(boChuThich(t.nd)) && !/\buseBamDong\b/.test(t.nd)).map((t) => t.ten);
    expect(sai, `Các tệp này dùng onRowClick= mà không qua useBamDong: ${sai.join(', ')}`).toEqual([]);
  });

  it('onRowClick phải nhận từ hook, không viết trần navigate(...)', () => {
    const sai = TEP.filter((t) => /\bonRowClick=\{\s*\(?\w*\)?\s*=>\s*navigate\(/.test(boChuThich(t.nd))).map((t) => t.ten);
    expect(sai, `onRowClick trần: ${sai.join(', ')}`).toEqual([]);
  });

  it('<tr> tự dựng có onClick mở trang: phải qua useBamDong', () => {
    const sai = TEP.filter((t) => {
      const nd = boChuThich(t.nd);
      return (
        /<tr\b[^>]*onClick=\{\s*\(\)\s*=>\s*navigate\(/.test(nd) &&
        !/\buseBamDong\b/.test(t.nd) &&
        !NGOAI_PHAM_VI.has(t.ten)
      );
    }).map((t) => t.ten);
    expect(sai, `<tr onClick={navigate} trần: ${sai.join(', ')}`).toEqual([]);
  });

  it('danh sách ngoại lệ không chứa tên thừa (tệp đã đổi thì phải gỡ khỏi danh sách)', () => {
    for (const ten of NGOAI_PHAM_VI) {
      const t = TEP.find((x) => x.ten === ten);
      expect(t, `${ten} không còn tồn tại — gỡ khỏi NGOAI_PHAM_VI`).toBeDefined();
      expect(/<tr\b[\s\S]{0,300}?onClick=/.test(boChuThich(t!.nd)), `${ten} đã hết dùng <tr onClick> — gỡ khỏi NGOAI_PHAM_VI`).toBe(true);
    }
  });

  it('bảy màn đã nối cấu hình, mỗi màn một khoá', () => {
    const man: Record<string, string> = {
      'pages/petitions/PetitionListPageShell.tsx': 'DON_THU',
      'pages/petitions/WardPetitionsPage.tsx': 'DON_THU_PHUONG',
      'pages/classification/DuplicatePetitionsPage.tsx': 'DON_TRUNG',
      'pages/incidents/IncidentListPageShell.tsx': 'VU_VIEC',
      'pages/cases/CaseListPageShell.tsx': 'VU_AN',
      'pages/cases/ComprehensiveListPageShell.tsx': 'TONG_HOP',
      'features/uy-thac-dieu-tra/UyThacDieuTraListPage.tsx': 'UY_THAC',
    };
    for (const [tep, khoa] of Object.entries(man)) {
      const t = TEP.find((x) => x.ten === tep);
      expect(t, tep).toBeDefined();
      expect(t!.nd, tep).toMatch(new RegExp(`useBamDong<[^>]*>\\('${khoa}'`));
    }
  });
});
