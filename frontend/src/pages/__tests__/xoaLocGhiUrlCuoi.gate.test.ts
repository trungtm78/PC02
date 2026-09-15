import { describe, it, expect } from 'vitest';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import tongHop from '../cases/ComprehensiveListPageShell.tsx?raw';

/**
 * CỔNG: nút "Xóa lọc" của màn danh sách phải xoá HẾT — thẻ tìm kiếm, ô chữ, trạng thái, mặt lọc.
 *
 * `setSearchParams(prev => …)` của React Router 7 tính `prev` từ tham số LÚC VẼ, không nối tiếp
 * lần ghi trước trong cùng lượt; lần ghi SAU thắng. Bốn màn từng gọi `url.clearAll()` rồi
 * `listFilters.reset()`: `reset` dựng lại địa chỉ từ tham số cũ và chỉ bỏ khoá mặt lọc, nên
 * thẻ, `q`, trạng thái quay lại. Bắt được ngày 15/09/2026 bằng ca kiểm tầng trang của Đơn thư.
 *
 * Hai điều phải cùng đúng:
 *  1. `listFilters.reset()` đứng TRƯỚC `url.clearAll()` — `clearAll` là lần ghi cuối;
 *  2. `useListFilters` cùng tiền tố với `useListPageUrlState` — `clearAll` chỉ xoá khoá có tiền
 *     tố của nó (Tổng hợp từng lệch 'comprehensive' ≠ 'comp').
 *
 * Đọc mã nguồn vì hành vi này chỉ lộ khi hai hook cùng ghi trong một lượt, ca kiểm từng hook
 * riêng lẻ đều xanh.
 */
const MAN = [
  ['Đơn thư', donThu],
  ['Vụ việc', vuViec],
  ['Vụ án', vuAn],
  ['Tổng hợp', tongHop],
] as const;

function thanXoaLoc(src: string): string {
  const i = src.indexOf('const handleResetFilters = useCallback(');
  expect(i).toBeGreaterThan(0);
  return src.slice(i, src.indexOf('}, [', i));
}

function viTriSai(src: string): string | null {
  const than = thanXoaLoc(src);
  const reset = than.indexOf('listFilters.reset()');
  const clear = than.indexOf('url.clearAll()');
  if (reset < 0 || clear < 0) return 'thiếu một trong hai lời gọi';
  return reset < clear ? null : '`url.clearAll()` không phải lần ghi cuối';
}

function tienTo(src: string) {
  return {
    url: /useListPageUrlState\('([^']+)'\)/.exec(src)?.[1],
    loc: /useListFilters<[^>]*>\(\{\s*(?:\/\/[^\n]*\n\s*)*prefix:\s*'([^']+)'/.exec(src)?.[1],
  };
}

describe('GATE "Xóa lọc" — clearAll là lần ghi URL cuối, cùng tiền tố', () => {
  it.each(MAN)('%s: reset trước, clearAll sau', (_ten, src) => {
    expect(viTriSai(src)).toBeNull();
  });

  it.each(MAN)('%s: mặt lọc cùng tiền tố với trạng thái URL', (_ten, src) => {
    const { url, loc } = tienTo(src);
    expect(url).toBeDefined();
    expect(loc).toBe(url);
  });

  it('gieo lỗi: đảo thứ tự hoặc lệch tiền tố thì cổng bắt được', () => {
    const dao = donThu.replace(
      /listFilters\.reset\(\);\s*url\.clearAll\(\);/,
      'url.clearAll();\n    listFilters.reset();',
    );
    expect(dao).not.toBe(donThu);
    expect(viTriSai(dao)).not.toBeNull();

    // Nhắm ĐÚNG tiền tố của mặt lọc: trang còn `useTheTimKiem({ prefix: 'comp' })` đứng trước, thay
    // chuỗi `prefix: 'comp'` đầu tiên là gieo nhầm chỗ và ca này đỏ vì lý do không liên quan.
    const lech = tongHop.replace(
      /(useListFilters<[^>]*>\(\{\s*(?:\/\/[^\n]*\n\s*)*prefix:\s*)'comp'/,
      "$1'comprehensive'",
    );
    expect(lech).not.toBe(tongHop);
    expect(tienTo(lech).loc).not.toBe(tienTo(lech).url);
  });
});
