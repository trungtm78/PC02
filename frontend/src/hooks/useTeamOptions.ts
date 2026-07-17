import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TeamOption {
  value: string; // Team.id (FK cho assignedTeamId)
  label: string; // Team.name
}

/**
 * Options Tổ/Nhóm cho FKSelect (đơn vị xử lý nội bộ).
 * GET /teams trả MẢNG THÔ (không bọc {data}) — đọc res.data trực tiếp.
 * Lọc isActive; value = id (khớp FK assignedTeamId).
 */
export function useTeamOptions(enabled = true) {
  return useQuery({
    queryKey: ['teams', 'options'],
    queryFn: async () => {
      const res = await api.get('/teams');
      const items: Array<{ id: string; name: string; isActive?: boolean }> = Array.isArray(res.data)
        ? res.data
        : (res.data?.data ?? []);
      return items
        .filter((t) => t.isActive !== false)
        .map((t) => ({ value: t.id, label: t.name })) as TeamOption[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
