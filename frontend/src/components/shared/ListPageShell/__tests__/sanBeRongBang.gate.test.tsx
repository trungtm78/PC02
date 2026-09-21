import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table, type ColumnDef } from '../Table';

/*
  HOTFIX 21/09/2026 — nút "In chứng từ" và nút ⋮ biến mất khỏi danh sách trên prod.

  Đo trên prod với tài khoản thật (ADMIN, đủ quyền): ô "Thao tác" khai 12rem = 192px nhưng
  DỰNG RA chỉ 113px ở 1280–1536px và 129px ở 1920px, và ô đặt `overflow: hidden`. Năm nút
  chiếm 176px nên hai nút cuối — In chứng từ và ⋮ "Thao tác khác" — bị CẮT CỤT.

    btn-view    317..345
    btn-edit    349..377
    btn-delete  381..409
    btn-print   413..441   ← ngoài mép ô (414)
    btn-menu    445..477   ← ngoài mép ô

  Nguyên nhân: `table-fixed` + `w-full` mà KHÔNG có sàn bề rộng thì trình duyệt co TỈ LỆ mọi
  cột cho vừa màn hình — `width` khai thành gợi ý, không phải lệnh. Chế độ "xuống dòng" đã có
  sàn `minWidth` (thêm 25/08/2026 cho đúng lớp lỗi này), chế độ "gọn" thì không, và "gọn" là
  mặc định.

  Hậu quả với người dùng: không in được từ danh sách, và với người có quyền điều phối thì mất
  luôn cả menu Phân công / Quản lý bị can / Quản lý luật sư. Không báo lỗi, không dấu hiệu gì —
  nút chỉ đơn giản không có ở đó.

  Ca kiểm này canh CƠ CHẾ (bảng luôn có sàn bề rộng). jsdom không dựng hình nên không đo được
  toạ độ; phép đo toạ độ thật nằm ở `tools/do-cot-thao-tac.mjs`, chạy trên prod.
*/
interface R { id: string }
const COT: ColumnDef<R>[] = [
  { key: 'actions', header: 'Thao tác', width: '12rem', sticky: true, render: () => 'x' },
  { key: 'a', header: 'A', width: '30rem', render: () => 'a' },
  { key: 'b', header: 'B', width: '30rem', render: () => 'b' },
];
const DONG: R[] = [{ id: '1' }];

function ve(props: Record<string, unknown> = {}) {
  render(
    <ListPageShell>
      <Table
        state="ready"
        columns={COT}
        data={DONG}
        rowKey={(r: R) => r.id}
        fixedLayout
        {...props}
      />
    </ListPageShell>,
  );
}
const bang = () => screen.getByRole('table');

describe('Bảng luôn có SÀN bề rộng — không co cột xuống dưới mức khai', () => {
  it('chế độ gọn (mặc định): bảng có min-width bằng tổng bề rộng khai', () => {
    ve();
    // 12rem (Thao tác) + 30rem + 30rem = 72rem. Khẳng định TỔNG chứ không đếm số hạng:
    // thiếu một cột là con số sai ngay, mà đếm số hạng thì `calc` gộp lại là hỏng phép đếm.
    expect(bang().getAttribute('style')).toBe('min-width: calc(72rem);');
  });

  it('chế độ xuống dòng: giữ nguyên sàn như trước', () => {
    ve({ xuongDong: true });
    expect(bang().getAttribute('style') ?? '').toContain('min-width');
  });

  /*
    Ô tick chọn nhiều dòng là một CỘT THẬT chèn trước mọi cột. Bỏ nó khỏi tổng thì bảng hụt
    đúng bề rộng ô tick và cột cuối lại bị cắt — cùng lớp lỗi, chỉ lệch chỗ.
  */
  it('có ô tick thì tổng phải cộng cả bề rộng ô tick', () => {
    ve({
      bulkSelection: {
        selectedIds: new Set<string>(),
        mode: 'page',
        count: 0,
        pageState: 'none',
        isSelected: () => false,
        toggleOne: () => {},
        togglePage: () => {},
        selectAllMatchingFilter: async () => {},
        clear: () => {},
      },
    });
    // 2.5rem (ô tick) + 72rem = 74.5rem. Bỏ ô tick khỏi tổng thì bảng hụt đúng 2.5rem.
    expect(bang().getAttribute('style')).toBe('min-width: calc(74.5rem);');
  });
});
