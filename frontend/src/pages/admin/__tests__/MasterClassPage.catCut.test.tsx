import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import MasterClassPage from '../MasterClassPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canEdit: () => true }) }));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const DONG = [
  { id: 'a', type: '00', code: 'NAM', name: 'Nam', order: 1, isActive: true },
  { id: 'b', type: '00', code: 'NU', name: 'Nữ', order: 2, isActive: true },
];

function dung(tongMayChu: number) {
  m.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url.includes('limit=1&') || url.endsWith('limit=1')
        ? { data: [], total: tongMayChu }
        : { data: DONG, total: tongMayChu },
    }),
  );
  const router = createMemoryRouter([{ path: '/', element: <MasterClassPage /> }]);
  return render(<RouterProvider router={router} />);
}

/**
 * Màn lọc TẠI CHỖ sau khi tải một lượt theo loại. An toàn chỉ khi tải ĐỦ: danh mục vượt ngưỡng tải thì
 * phần sau ngưỡng không bao giờ hiện, gõ tìm đúng cũng không ra — cùng lớp lỗi Hướng dẫn đơn (100/541).
 * Không lặng im: máy chủ báo tổng lớn hơn số dòng đã tải thì NÓI ra.
 */
describe('Phân loại danh mục — không cắt cụt âm thầm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tổng máy chủ lớn hơn số dòng tải về → báo đang hiện một phần', async () => {
    dung(620);
    const bao = await screen.findByTestId('master-class-cat-cut');
    expect(bao).toHaveTextContent('2');
    expect(bao).toHaveTextContent('620');
  });

  it('tải đủ → không báo', async () => {
    dung(2);
    await screen.findByText('Nam');
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(screen.queryByTestId('master-class-cat-cut')).not.toBeInTheDocument();
  });
});
