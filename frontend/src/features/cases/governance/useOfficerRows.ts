import { useOfficerOptions } from "@/hooks/useOfficerOptions";
import type { Row } from "./shared";
export function useOfficerRows(enabled = true) {
  const source = useOfficerOptions(enabled);
  return {
    rows: (source.data ?? []).map((option) => ({
      id: option.value,
      name: option.label,
      teams: option.teams,
      ...(option.caseAccessMode && { caseAccessMode: option.caseAccessMode }),
    })) as Row[],
    loading: source.isLoading,
    error: source.error ? "Không tải được danh sách cán bộ." : "",
  };
}
