import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import type { Capabilities } from "./governance/shared";
export function useCaseCapabilities(caseId?: string) {
  const endpoint = caseId
    ? `/cases/${encodeURIComponent(caseId)}/capabilities`
    : "/cases/governance/capabilities";
  const [state, setState] = useState<{
    endpoint: string;
    capabilities: Capabilities;
    loading: boolean;
    error: string;
  }>({ endpoint, capabilities: {}, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    api
      .get<{ data: Capabilities }>(endpoint)
      .then((response) => {
        if (active)
          setState({
            endpoint,
            capabilities: response.data.data ?? {},
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (active)
          setState({
            endpoint,
            capabilities: {},
            loading: false,
            error: extractApiError(error).message,
          });
      });
    return () => {
      active = false;
    };
  }, [endpoint]);
  return state.endpoint === endpoint
    ? state
    : { endpoint, capabilities: {}, loading: true, error: "" };
}
