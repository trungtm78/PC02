import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table } from '../Table';
import type { ColumnDef } from '../Table';

type Row = { id: string };
const ROWS: Row[] = [{ id: 'r1' }];
const COT: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', width: '7rem', sticky: true, render: () => 'x' },
  { key: 'tomTat', header: 'Tóm tắt', width: '20rem', optional: 'show', render: () => 'y' },
  { key: 'nguon', header: 'Nguồn', width: '120px', optional: 'show', render: () => 'z' },
];

function ve(props: Record<string, unknown> = {}) {
  render(
    <ListPageShell>
      <Table state="ready" columns={COT} data={ROWS} rowKey={(r: Row) => r.id} fixedLayout {...props} />
    </ListPageShell>,
  );
}

/**
 * Ráp tay nắm kéo giãn vào ô tiêu đề. Rủi ro lớn nhất KHÔNG phải là kéo không chạy — mà là
 * bảng đổi bố cục cho 46.000 hồ sơ của những người CHƯA HỀ kéo gì.
 */
describe('<Table> — kéo giãn cột', () => {
  it('không truyền `onKeoGian` thì KHÔNG hiện tay nắm — giữ nguyên bảng cũ', () => {
    ve();
    expect(screen.queryByTestId('tay-nam-keo-tomTat')).not.toBeInTheDocument();
  });

  it('truyền `onKeoGian` thì mỗi cột có một tay nắm', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByTestId('tay-nam-keo-tomTat')).toBeInTheDocument();
    expect(screen.getByTestId('tay-nam-keo-nguon')).toBeInTheDocument();
  });

  it('kéo báo đúng tên cột và bề rộng mới', () => {
    const keo = vi.fn();
    ve({ onKeoGian: keo });
    const nam = screen.getByTestId('tay-nam-keo-nguon');
    fireEvent.pointerDown(nam, { pointerId: 1, clientX: 0, button: 0 });
    fireEvent.pointerUp(nam, { pointerId: 1, clientX: 50 });
    expect(keo).toHaveBeenCalledWith('nguon', 170);
  });

  /**
   * CỔNG QUAN TRỌNG NHẤT: người chưa kéo gì phải thấy bảng y hệt hôm qua.
   *
   * Bề rộng hiện tại đo từ dữ liệu thật (`PetitionListPageShell.tsx` — trung vị/phân vị 90 của
   * 46.000 hồ sơ). Đổi âm thầm là làm hỏng thứ đã cân chỉnh, cho tất cả mọi người.
   */
  it('bề rộng khai trong mã KHÔNG đổi khi bật kéo giãn', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('columnheader', { name: /Tóm tắt/ })).toHaveStyle({ width: '20rem' });
    expect(screen.getByRole('columnheader', { name: /Thao tác/ })).toHaveStyle({ width: '7rem' });
  });

  it('vẫn giữ bố cục cố định — width là LỆNH, không phải gợi ý', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('table').className).toContain('table-fixed');
  });

  /**
   * Anh chốt: kéo rộng ra thì BẢNG DÀI THÊM và cuộn ngang, cột bên cạnh giữ nguyên. Muốn vậy
   * bảng phải có tổng bề rộng tường minh; để `w-full` thì các cột bị chia lại theo tỷ lệ và
   * kéo cột này làm co cột kia.
   *
   * Dùng `calc()` để KHỎI quy đổi `rem` sang px — quy đổi bằng tay là đoán cỡ chữ gốc và sai
   * lặng lẽ trên máy đặt cỡ chữ khác.
   */
  it('bật kéo giãn thì bảng có tổng bề rộng tường minh, tính bằng calc()', () => {
    ve({ onKeoGian: vi.fn() });
    const w = screen.getByRole('table').style.width;
    expect(w).toContain('calc(');
    expect(w).toContain('7rem');
    expect(w).toContain('20rem');
    expect(w).toContain('120px');
  });

  it('bảng vẫn phủ hết bề ngang khi tổng cột hẹp hơn màn hình', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('table').style.minWidth).toBe('100%');
  });

  it('không bật kéo giãn thì KHÔNG đặt tổng bề rộng — bảng cũ y nguyên', () => {
    ve();
    expect(screen.getByRole('table').style.width).toBe('');
  });

  /** Ô tiêu đề phải là gốc toạ độ, nếu không tay nắm bay ra góc trang. */
  it('ô tiêu đề có `relative` để neo tay nắm', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('columnheader', { name: /Tóm tắt/ }).className).toContain('relative');
  });

  /**
   * Kéo cột rồi thu hẹp lại phải cắt chữ, không vẽ đè sang cột bên — cặp
   * `whitespace-nowrap` + `overflow-hidden` là thứ giữ điều đó (sự cố mã dài trong cột STT
   * 7rem, 25/08/2026).
   */
  it('ô dữ liệu giữ cặp chống tràn chữ', () => {
    ve({ onKeoGian: vi.fn() });
    const o = screen.getAllByRole('cell')[1];
    expect(o.className).toContain('whitespace-nowrap');
    expect(o.className).toContain('overflow-hidden');
  });

  it('bấm đúp tay nắm gọi trả cột về mặc định', () => {
    const veMacDinh = vi.fn();
    ve({ onKeoGian: vi.fn(), onVeMacDinhCot: veMacDinh });
    fireEvent.doubleClick(screen.getByTestId('tay-nam-keo-nguon'));
    expect(veMacDinh).toHaveBeenCalledWith('nguon');
  });
});

/**
 * HỒI QUY: bật kéo giãn KHÔNG được làm hỏng cột ghim.
 *
 * Bản đầu thêm `relative` vào MỌI ô tiêu đề để neo tay nắm. `relative` và `sticky` cùng là
 * thuộc tính `position`, nên ô ghim mất `sticky` và cột Thao tác trôi đi ngay khi cuộn ngang —
 * đúng cột cán bộ bấm nhiều nhất, và là cột được cố ý đưa lên đầu 25/08/2026.
 *
 * Ba ca kiểm trang danh sách đã bắt được điều này; cổng dưới đây kéo nó về tầng component để
 * lần sau đỏ ngay tại chỗ sửa, không phải đi vòng qua ba trang.
 */
describe('<Table> — kéo giãn không phá cột ghim', () => {
  it('ô tiêu đề ghim GIỮ `sticky` và KHÔNG bị thêm `relative`', () => {
    ve({ onKeoGian: vi.fn() });
    const o = screen.getByRole('columnheader', { name: /Thao tác/ });
    expect(o.className).toContain('sticky');
    expect(o.className).not.toContain('relative');
  });

  it('cột ghim vẫn có tay nắm — nó vẫn kéo giãn được', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByTestId('tay-nam-keo-actions')).toBeInTheDocument();
  });
});

/**
 * HỒI QUY: nhãn tay nắm KHÔNG được lẫn vào tên ô tiêu đề.
 *
 * Thuật toán tính tên của `<th>` gộp cả `aria-label` của phần tử con, nên khi thêm tay nắm,
 * tên ô thành "Thao tác Kéo giãn cột Thao tác" — trình đọc màn hình đọc thừa ở MỌI cột, và ba
 * ca kiểm ở tầng trang tìm ô theo tên chính xác đều đỏ.
 */
describe('<Table> — tên ô tiêu đề không lẫn nhãn tay nắm', () => {
  it('tên ô tiêu đề đúng bằng nhãn cột, dù đã bật kéo giãn', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('columnheader', { name: 'Thao tác' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tóm tắt' })).toBeInTheDocument();
  });

  it('tay nắm vẫn giữ nhãn riêng cho người dùng bàn phím', () => {
    ve({ onKeoGian: vi.fn() });
    expect(screen.getByRole('separator', { name: /Kéo giãn cột Tóm tắt/ })).toBeInTheDocument();
  });
});
