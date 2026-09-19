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
});

/** CỔNG: mọi route SỬA theo id đều bọc DungLaiTheoId — thêm form sửa mới mà quên là đỏ. */
const NGUON = import.meta.glob('../../../features/*/routes.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

describe('CỔNG route sửa theo id', () => {
  it('route `:id/edit` render trang thật đều bọc <DungLaiTheoId>', () => {
    const thieu: string[] = [];
    let soRoute = 0;
    for (const [tep, ma] of Object.entries(NGUON)) {
      for (const m of ma.matchAll(/<Route\b[^>]*?path=["'][^"']*:id\/edit["'][\s\S]*?\/>/g)) {
        const khoi = m[0];
        if (!khoi.includes('wrapRoute(')) continue; // chuyển hướng, không phải form
        soRoute++;
        if (!khoi.includes('<DungLaiTheoId>')) thieu.push(`${tep}: ${khoi.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    expect(soRoute).toBeGreaterThanOrEqual(4);
    expect(thieu).toEqual([]);
  });
});
