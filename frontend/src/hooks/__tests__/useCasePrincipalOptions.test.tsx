import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useCasePrincipalOptions } from "../useCasePrincipalOptions";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
const authority = {
  actorId: "manager",
  enabled: true,
  manage_access: true,
  caseAccessMode: "INTERNAL" as const,
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
beforeEach(() => vi.clearAllMocks());
it.each([
  { ...authority, manage_access: false },
  { ...authority, enabled: false },
  { ...authority, caseAccessMode: "REPRESENTATION_ONLY" as const },
  { ...authority, actorId: undefined },
])(
  "does not enumerate accounts without actual management authority %j",
  async (caps) => {
    renderHook(() => useCasePrincipalOptions(caps), { wrapper });
    await Promise.resolve();
    expect(api.get).not.toHaveBeenCalled();
  },
);
it("allows authorized managers to select inactive principals and paginates the exact directory contract", async () => {
  vi.mocked(api.get).mockImplementation(async (_url, config) => ({
    data: {
      data:
        config?.params.offset === 0
          ? Array.from({ length: 500 }, (_, i) => ({
              id: `u${i}`,
              username: `account${i}`,
              isActive: true,
            }))
          : [{ id: "inactive", username: "disabled account", isActive: false }],
      total: 501,
    },
  }));
  const { result } = renderHook(() => useCasePrincipalOptions(authority), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data).toHaveLength(501));
  expect(result.current.data?.find((row) => row.id === "inactive")).toEqual({
    id: "inactive",
    name: "disabled account",
    isActive: false,
  });
  expect(api.get).toHaveBeenCalledWith("/admin/users", {
    params: { limit: 500, offset: 500 },
  });
});
it("rejects malformed account identities instead of presenting unverified management targets", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { data: [{ id: 42, username: "invalid" }] },
  });
  const { result } = renderHook(() => useCasePrincipalOptions(authority), {
    wrapper,
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});
