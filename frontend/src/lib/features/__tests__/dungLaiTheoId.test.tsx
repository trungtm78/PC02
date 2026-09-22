import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom';
import { DungLaiTheoId } from '../dungLaiTheoId';

/**
 * Rà mã độc lập 19/09/2026 (PR #430): đi thẳng /cases/A/edit → /cases/B/edit, React GIỮ NGUYÊN form — mục thêm mới
 * đang nhập cho A (chưa lưu) bị ghi vào B khi bấm Lưu; kết quả tải trễ của A trộn vào form B. Form sửa phải dựng lại
 * từ đầu mỗi khi đổi hồ sơ.
 */
let soLanDung = 0;
function Form() {
  const { id } = useParams();
  useEffect(() => {
    soLanDung++;
  }, []);
  return <p data-testid="form">{id}</p>;
}

describe('DungLaiTheoId', () => {
  it('đổi :id → dựng lại trang (state cũ không mang sang hồ sơ mới)', async () => {
    soLanDung = 0;
    const router = createMemoryRouter(
      [{ path: '/x/:id/edit', element: <DungLaiTheoId><Form /></DungLaiTheoId> }],
      { initialEntries: ['/x/A/edit'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('form')).toHaveTextContent('A');
    expect(soLanDung).toBe(1);
    await act(() => router.navigate('/x/B/edit'));
    expect(screen.getByTestId('form')).toHaveTextContent('B');
    expect(soLanDung).toBe(2);
  });

  /**
   * Cùng MỘT loại component ở hai route khác nhau thì React giữ nguyên state — `:id` đổi từ
   * "A" sang `undefined` vẫn là "đổi", nhưng khoá theo id không phân biệt được "/x/new" với
   * "/x/A" (cả hai cho `undefined` và "A" thì khác, còn "/x/A" → "/x/new" thì id mất hẳn).
   *
   * Phát hiện 22/09/2026 khi làm nút "Tạo đơn mới từ đơn này": đi từ màn XEM một đơn sang màn
   * TẠO MỚI, form mang theo NGUYÊN mã hồ sơ "2024-00123" và ô "Kết quả xử lý" của đơn cũ. Cán
   * bộ bấm Lưu là tạo một đơn mới mang mã của đơn cũ.
   */
  it('đổi ĐƯỜNG DẪN (xem hồ sơ → tạo mới) cũng dựng lại trang', async () => {
    soLanDung = 0;
    const router = createMemoryRouter(
      [
        { path: '/x/new', element: <DungLaiTheoId><Form /></DungLaiTheoId> },
        { path: '/x/:id', element: <DungLaiTheoId><Form /></DungLaiTheoId> },
      ],
      { initialEntries: ['/x/A'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('form')).toHaveTextContent('A');
    expect(soLanDung).toBe(1);
    await act(() => router.navigate('/x/new'));
    expect(
      soLanDung,
      'màn tạo mới dùng lại state của hồ sơ vừa xem — đơn mới mang mã đơn cũ',
    ).toBe(2);
  });
});

/**
 * CỔNG: mọi route dựng một trang FORM đều bọc DungLaiTheoId — thêm form mới mà quên là đỏ.
 *
 * Mở rộng 22/09/2026 từ "route `:id/edit`" sang "mọi route form". Luật cũ bỏ sót đúng cặp gây
 * lỗi: `/petitions/:id` (xem) và `/petitions/new` (tạo) cùng dựng `PetitionFormPage`, cùng
 * hình dạng cây, nên React dùng lại state — không route nào trong cặp ấy có `:id/edit`.
 */
const NGUON = import.meta.glob('../../../features/*/routes.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

describe('CỔNG route form', () => {
  it('mọi route dựng một trang FormPage đều bọc <DungLaiTheoId>', () => {
    const thieu: string[] = [];
    let soRoute = 0;
    for (const [tep, ma] of Object.entries(NGUON)) {
      for (const m of ma.matchAll(/<Route\b[\s\S]*?\/>/g)) {
        const khoi = m[0];
        if (!khoi.includes('wrapRoute(')) continue; // chuyển hướng, không phải trang thật
        if (!/FormPage\s*\/>/.test(khoi)) continue; // chỉ canh trang form
        soRoute++;
        if (!khoi.includes('<DungLaiTheoId>'))
          thieu.push(`${tep}: ${khoi.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    expect(
      soRoute,
      'cổng không thấy route form nào — bộ quét hỏng, không phải kho mã sạch',
    ).toBeGreaterThanOrEqual(8);
    expect(thieu).toEqual([]);
  });
});
