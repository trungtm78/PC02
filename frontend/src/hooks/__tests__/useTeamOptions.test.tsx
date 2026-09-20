import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTeamOptions } from '../useTeamOptions';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
import { api } from '@/lib/api';
const get = api.get as unknown as ReturnType<typeof vi.fn>;

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => get.mockReset());

/*
  Ô "Đơn vị xử lý" ở hướng Giao đơn / Trả đơn-Lưu đơn ăn danh sách này, và nhãn của nó là
  "Chọn Tổ/Nhóm xử lý".

  Đo prod 20/09/2026: `GET /teams` trả 192 tổ hoạt động, trong đó **166 là công an phường/xã**
  và chỉ **26 là Tổ/Nhóm thật**. Không lọc thì cán bộ gõ "Công an" ra 166 dòng công an phường —
  đúng thứ ảnh chụp màn hình anh gửi — và Tổ mình cần bị chôn trong đó.

  Và 0 đơn thư nào đang dùng tên tổ ĐỊA BÀN làm Đơn vị xử lý, còn 17.199 đơn dùng tên Tổ chức
  năng. Nên lọc bỏ địa bàn không mất một dòng dữ liệu nào.

  Phân biệt bằng cột `Team.wardId` (khai từ v0.33: rỗng = tổ chức năng), KHÔNG đoán theo tên —
  tên là thứ người ta sửa được.
*/
describe('useTeamOptions — chỉ Tổ/Nhóm nội bộ', () => {
  it('BỎ tổ địa bàn (có wardId), giữ tổ chức năng', async () => {
    get.mockResolvedValue({
      data: [
        { name: 'Tổ công tác Số 2', isActive: true, wardId: null },
        { name: 'Công an Phường An Hội Tây', isActive: true, wardId: 'w1' },
        { name: 'PC02', isActive: true, wardId: null },
      ],
    });
    const { result } = renderHook(() => useTeamOptions(), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.map((o) => o.value)).toEqual(['Tổ công tác Số 2', 'PC02']);
  });

  it('vẫn bỏ tổ đã ngừng hoạt động', async () => {
    get.mockResolvedValue({
      data: [
        { name: 'Tổ còn dùng', isActive: true, wardId: null },
        { name: 'Tổ đã tắt', isActive: false, wardId: null },
      ],
    });
    const { result } = renderHook(() => useTeamOptions(), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((o) => o.value)).toEqual(['Tổ còn dùng']);
  });

  it('máy chủ không gửi `wardId` thì coi là tổ chức năng — mặc định an toàn', async () => {
    // Đoán nhầm thành địa bàn sẽ xoá sạch danh sách, tệ hơn hẳn việc thừa vài dòng.
    get.mockResolvedValue({ data: [{ name: 'Tổ cũ', isActive: true }] });
    const { result } = renderHook(() => useTeamOptions(), { wrapper: boc });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((o) => o.value)).toEqual(['Tổ cũ']);
  });
});
