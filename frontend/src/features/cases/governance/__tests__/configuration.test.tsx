import { render, screen, fireEvent, waitFor } from "./render-governance";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import CaseConfigurationPage from "../CaseConfigurationPage";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.endsWith("/capabilities")
        ? {
            enabled: true,
            caseAccessMode: "INTERNAL",
            operate: true,
            review: true,
            publish: true,
          }
        : url.endsWith("/catalog")
          ? {
              actions: [
                { code: "CONCLUDE_INITIAL", label: "Kết luận điều tra" },
              ],
              additionalActions: [],
            }
          : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({
    data: { data: { id: "configuration1" } },
  });
});
it("creates typed published-field configuration through structured inputs", async () => {
  render(
    <MemoryRouter>
      <CaseConfigurationPage />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "Trường thông tin" }));
  fireEvent.click(screen.getByRole("button", { name: "Thêm trường bổ sung" }));
  fireEvent.change(screen.getByLabelText("Khóa trường 1"), {
    target: { value: "custom_verified" },
  });
  fireEvent.change(screen.getByLabelText("Nhãn trường 1"), {
    target: { value: "Thông tin xác minh" },
  });
  fireEvent.change(screen.getByLabelText("Kiểu dữ liệu 1"), {
    target: { value: "boolean" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo cấu hình" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/governance/field-definitions",
      expect.objectContaining({
        code: "default",
        definition: expect.objectContaining({
          fields: [
            expect.objectContaining({
              key: "custom_verified",
              type: "boolean",
              required: false,
            }),
          ],
        }),
        requestKey: expect.any(String),
      }),
    ),
  );
});
it("creates a rule draft with explicit legal source and effective dates", async () => {
  render(
    <MemoryRouter>
      <CaseConfigurationPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Thêm thao tác quy tắc" }),
  );
  fireEvent.change(screen.getByLabelText("Thao tác quy tắc 1"), {
    target: { value: "CONCLUDE_INITIAL" },
  });
  fireEvent.change(screen.getByLabelText("Có hiệu lực từ"), {
    target: { value: "2026-10-01" },
  });
  for (const [key, value] of Object.entries({
    "Văn bản nguồn 1.1": "Văn bản đã kiểm chứng",
    "Điều khoản 1.1": "Điều 1",
    "URL nguồn 1.1": "https://example.test/source",
    "Thẩm quyền nguồn 1.1": "CQĐT",
    "Nguồn có hiệu lực từ 1.1": "2026-10-01",
  }))
    fireEvent.change(screen.getByLabelText(key), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo cấu hình" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/governance/rules",
      expect.objectContaining({
        effectiveFrom: "2026-10-01",
        definition: {
          actions: [
            expect.objectContaining({
              code: "CONCLUDE_INITIAL",
              legalSources: [
                expect.objectContaining({
                  provision: "Điều 1",
                  authority: "CQĐT",
                }),
              ],
            }),
          ],
        },
      }),
    ),
  );
});
