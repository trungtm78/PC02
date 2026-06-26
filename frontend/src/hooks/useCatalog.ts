import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CATALOG_LEGAL,
  CATALOG_META,
  type CatalogOption,
} from "@/shared/catalog/catalog.generated";

const LEGAL = CATALOG_LEGAL as Record<string, readonly CatalogOption[]>;
const META = CATALOG_META as Record<string, { kind: string; multi: boolean; cascade?: unknown }>;

/**
 * Lấy options của 1 danh mục catalog đồng nhất:
 * - legal: đọc inline từ catalog.generated (không gọi API).
 * - dynamic: GET /catalog/:key/options (React Query, cache 10').
 */
export function useCatalog(key: string): { options: CatalogOption[]; isLoading: boolean } {
  const isLegal = META[key]?.kind === "legal";

  const query = useQuery({
    queryKey: ["catalog", key],
    queryFn: async () => {
      const res = await api.get(`/catalog/${key}/options`);
      return (res.data ?? []) as CatalogOption[];
    },
    enabled: !isLegal,
    staleTime: 10 * 60 * 1000,
  });

  if (isLegal) return { options: [...(LEGAL[key] ?? [])], isLoading: false };
  return { options: query.data ?? [], isLoading: query.isLoading };
}

export function useCatalogLabel(key: string, code: string | null | undefined): string {
  const { options } = useCatalog(key);
  if (!code) return "";
  return options.find((o) => o.code === code)?.label ?? code;
}
