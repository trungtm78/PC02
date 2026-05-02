import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DirectoryOption {
  value: string;
  label: string;
}

export function useDirectoryOptions(
  type: string | undefined,
  opts?: { limit?: number; returnId?: boolean },
) {
  const limit = opts?.limit ?? 200;
  const returnId = opts?.returnId ?? false;

  return useQuery({
    queryKey: ['directories', type, returnId ? 'by-id' : 'by-name'],
    queryFn: async () => {
      const res = await api.get(
        `/directories?type=${type}&limit=${limit}&isActive=true`,
      );
      const items = res.data?.data ?? [];
      return items.map((d: { id: string; name: string; code: string }) => ({
        // returnId=true: value is the DB id (for parentId foreign key)
        // returnId=false (default): value is the name (for simple string fields)
        value: returnId ? d.id : d.name,
        label: returnId ? `${d.name} (${d.code})` : d.name,
      })) as DirectoryOption[];
    },
    enabled: !!type,
    staleTime: 10 * 60 * 1000,
  });
}
