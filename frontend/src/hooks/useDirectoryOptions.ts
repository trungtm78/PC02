import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DirectoryOption {
  value: string;
  label: string;
}

export function useDirectoryOptions(
  type: string | undefined,
  opts?: { limit?: number },
) {
  const limit = opts?.limit ?? 200;

  return useQuery({
    queryKey: ['directories', type],
    queryFn: async () => {
      const res = await api.get(
        `/directories?type=${type}&limit=${limit}&isActive=true`,
      );
      const items = res.data?.data ?? [];
      return items.map((d: { id: string; name: string }) => ({
        value: d.name,
        label: d.name,
      })) as DirectoryOption[];
    },
    enabled: !!type,
    staleTime: 10 * 60 * 1000,
  });
}
