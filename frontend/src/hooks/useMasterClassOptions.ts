import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MasterClassOption {
  value: string;
  label: string;
}

export function useMasterClassOptions(type: string | undefined) {
  return useQuery({
    queryKey: ['master-classes', type],
    queryFn: async () => {
      const res = await api.get(
        `/master-classes?type=${type}&limit=200&isActive=true`,
      );
      const items = res.data?.data ?? [];
      return items.map((d: { id: string; name: string }) => ({
        value: d.name,
        label: d.name,
      })) as MasterClassOption[];
    },
    enabled: !!type,
    staleTime: 10 * 60 * 1000,
  });
}
