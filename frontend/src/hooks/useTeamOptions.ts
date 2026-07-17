import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TeamOption {
  value: string; // Team.name (lưu vào donViXuLy — text; Team.name là @unique)
  label: string; // Team.name
}

/**
 * Options Tổ/Nhóm cho FKSelect "Đơn vị xử lý" khi thuộc thẩm quyền.
 * GET /teams trả MẢNG THÔ (không bọc {data}) — đọc res.data trực tiếp.
 * Lọc isActive; value = name (lưu tên tổ vào donViXuLy, đồng nhất với nhánh danh mục DON_VI).
 */
export function useTeamOptions(enabled = true) {
  return useQuery({
    queryKey: ['teams', 'options'],
    queryFn: async () => {
      const res = await api.get('/teams');
      const items: Array<{ name: string; isActive?: boolean }> = Array.isArray(res.data)
        ? res.data
        : (res.data?.data ?? []);
      return items
        .filter((t) => t.isActive !== false)
        .map((t) => ({ value: t.name, label: t.name })) as TeamOption[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
