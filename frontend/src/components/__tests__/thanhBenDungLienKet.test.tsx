import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AppSidebar } from '../AppSidebar';

vi.mock('@/hooks/useBadgeCounts', () => ({
  useBadgeCounts: () => ({ counts: {}, refresh: vi.fn() }),
}));

const CAY = [
  {
    // Dùng mục 'business' vì thanh bên mặc định MỞ sẵn 'main' và 'business'; nhóm con đặt id
    // khác 'cases'/'subjects' vì hai cái ấy cũng mở sẵn — cần một nhóm ĐÓNG để đo lần bấm.
    id: 'business',
    label: 'Nghiệp vụ chính',
    icon: FileText,
    items: [
      { id: 'kpi', label: 'Chỉ tiêu KPI', icon: FileText, path: '/kpi', order: 1 },
      {
        id: 'cases-group',
        label: 'Quản lý vụ án',
        icon: FileText,
        order: 2,
        children: [
          { id: 'case-list', label: 'Danh sách vụ án', icon: FileText, path: '/cases', order: 1 },
        ],
      },
    ],
  },
];

vi.mock('@/lib/features', () => ({ useMenuSections: () => CAY }));

function dung() {
  return render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
}

/**
 * Thanh điều hướng phải nói đúng thứ nó là.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, đếm trên trang đã đăng nhập:
 *
 *     so <a href>   : 0
 *     so <a> bat ky : 0
 *     so <button>   : 33
 *     so [role=link]: 0
 *
 * Toàn bộ ứng dụng KHÔNG có một liên kết nào. Điều hướng đi 100% bằng `<button onClick>`.
 *
 * Hệ quả đo được, không phải suy đoán: không Ctrl+bấm để mở tab mới, không chuột giữa, không
 * chuột phải "sao chép địa chỉ", không rê chuột xem đích. Với 238 cán bộ mở song song hai hồ sơ
 * để đối chiếu, đó là thao tác hằng ngày — và hiện không làm được.
 *
 * Cùng lượt đo: 8 nhóm trong thanh bên trả `aria-expanded=null`. Trình đọc màn hình không biết
 * đó là nhóm đóng/mở được, và không máy nào phân biệt được đang mở hay đang đóng — chính điều
 * ấy làm bộ dò tự động của phiên soát phải bỏ, chuyển sang đo tay từng nhóm.
 *
 * ── Luật ──
 *
 * Đi tới một địa chỉ thì là LIÊN KẾT. Mở/đóng một nhóm thì là NÚT, và phải khai `aria-expanded`.
 * Hai thứ khác nhau về bản chất, không phải về cách vẽ.
 */
describe('Thanh bên: đi tới địa chỉ thì phải là liên kết', () => {
  it('mục lá có đường dẫn render thành thẻ liên kết, kèm href thật', () => {
    dung();
    const o = screen.getByTestId('sidebar-item-kpi');
    expect(o.tagName).toBe('A');
    expect(o).toHaveAttribute('href', '/kpi');
  });

  /** Mục con nằm sâu cũng vậy — không được chỉ sửa lớp ngoài. */
  it('mục lá lồng bên trong nhóm cũng là liên kết', () => {
    dung();
    fireEvent.click(screen.getByTestId('sidebar-item-cases-group'));
    const o = screen.getByTestId('sidebar-item-case-list');
    expect(o.tagName).toBe('A');
    expect(o).toHaveAttribute('href', '/cases');
  });

  /** Nhóm KHÔNG được thành liên kết — nó không đi đâu cả, nó mở ra. */
  it('nhóm có con vẫn là nút, không phải liên kết', () => {
    dung();
    expect(screen.getByTestId('sidebar-item-cases-group').tagName).toBe('BUTTON');
  });

  /**
   * Chốt bao quát: không mục nào vừa có đường dẫn vừa là nút. Ai thêm mục mới bằng `<button>`
   * kèm `navigate()` sẽ làm ca này đỏ — đó chính là điều cần xảy ra.
   */
  it('không mục lá nào còn là nút', () => {
    dung();
    fireEvent.click(screen.getByTestId('sidebar-item-cases-group'));
    for (const id of ['kpi', 'case-list']) {
      expect(screen.getByTestId(`sidebar-item-${id}`).tagName).toBe('A');
    }
  });
});

describe('Thanh bên: nhóm phải khai trạng thái đóng/mở', () => {
  it('mục cha khai aria-expanded và đổi theo lần bấm', () => {
    dung();
    const m = screen.getByTestId('sidebar-section-business');
    const truoc = m.getAttribute('aria-expanded');
    expect(truoc).toMatch(/true|false/);
    fireEvent.click(m);
    expect(screen.getByTestId('sidebar-section-business').getAttribute('aria-expanded')).not.toBe(
      truoc,
    );
  });

  it('nhóm bên trong cũng khai aria-expanded và đổi theo lần bấm', () => {
    dung();
    const g = screen.getByTestId('sidebar-item-cases-group');
    expect(g.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(g);
    expect(screen.getByTestId('sidebar-item-cases-group').getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  /** Mục lá KHÔNG được khai aria-expanded — nó chẳng mở ra cái gì. */
  it('mục lá không khai aria-expanded', () => {
    dung();
    expect(screen.getByTestId('sidebar-item-kpi')).not.toHaveAttribute('aria-expanded');
  });
});
