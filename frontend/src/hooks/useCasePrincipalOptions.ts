import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { hoTen } from "@/lib/hoTen";
interface DirectoryAuthority {
  actorId?: string;
  enabled?: boolean;
  manage_access?: boolean;
  caseAccessMode?: "INTERNAL" | "REPRESENTATION_ONLY";
}
interface PrincipalRecord {
  id: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean;
}
export interface PrincipalOption extends Record<string, unknown> {
  id: string;
  name: string;
  isActive?: boolean;
}
/** Management targets include inactive accounts; this is distinct from active officer assignment. */
export function useCasePrincipalOptions(caps: DirectoryAuthority) {
  const permitted =
    !!caps.actorId &&
    caps.enabled === true &&
    caps.manage_access === true &&
    caps.caseAccessMode === "INTERNAL";
  return useQuery({
    queryKey: ["case-principal-directory", caps.actorId, permitted],
    enabled: permitted,
    queryFn: async (): Promise<PrincipalOption[]> => {
      if (!permitted) return [];
      const result = new Map<string, PrincipalOption>();
      for (let offset = 0; ; offset += 500) {
        const response = await api.get<
          PrincipalRecord[] | { data: PrincipalRecord[]; total?: number }
        >("/admin/users", { params: { limit: 500, offset } });
        const body = response.data;
        const rows = Array.isArray(body) ? body : body?.data;
        if (
          !Array.isArray(rows) ||
          rows.some(
            (row) =>
              !row ||
              typeof row.id !== "string" ||
              !row.id ||
              (row.isActive !== undefined &&
                typeof row.isActive !== "boolean") ||
              [row.username, row.firstName, row.lastName].some(
                (value) => value != null && typeof value !== "string",
              ),
          )
        )
          throw new Error("Không xác minh được danh sách tài khoản.");
        for (const row of rows)
          result.set(row.id, {
            id: row.id,
            name: hoTen(row, undefined) || row.id,
            isActive: row.isActive,
          });
        const total = Array.isArray(body)
          ? result.size
          : Number(body.total ?? result.size);
        if (rows.length < 500 || result.size >= total) break;
      }
      return [...result.values()];
    },
    staleTime: 60_000,
  });
}
