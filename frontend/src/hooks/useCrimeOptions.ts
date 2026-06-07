import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CrimeOption } from '@/components/crime-select-utils';

interface CrimeApiRow {
  id: string;
  code: string;
  name: string;
  pc02Relevant: boolean;
  articleNo: number;
}

// Tải TOÀN BỘ tội danh (limit cao để không truncate 316 điều). CrimeSelect lọc PC02/hiện-tất-cả
// và search ở client trên tập đầy đủ → search luôn bao phủ cả 316.
export function useCrimeOptions() {
  return useQuery({
    queryKey: ['crimes', 'all'],
    queryFn: async (): Promise<CrimeOption[]> => {
      const res = await api.get('/crimes?pc02Only=false&isActive=true&limit=1000');
      const items: CrimeApiRow[] = res.data?.data ?? [];
      return items.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        pc02Relevant: c.pc02Relevant,
        articleNo: c.articleNo,
      }));
    },
    staleTime: 30 * 60 * 1000,
  });
}
