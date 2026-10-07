import { render, screen, fireEvent, waitFor } from "./render-governance";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import CaseOperationsPage from "../CaseOperationsPage";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const clock = "2026-10-06T02:00:00.000Z";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.endsWith("/capabilities")
        ? {
            enabled: true,
            operate: true,
            actorId: "sender",
            manage_access: true,
            caseAccessMode: "INTERNAL",
          }
        : url.endsWith("/dashboard")
          ? {
              clock,
              buckets: [
                {
                  key: "overdue",
                  count: 2,
                  link: "/cases?governanceQueue=overdue",
                },
              ],
            }
          : url.endsWith("/handoffs/inbox")
            ? [
                {
                  id: "handoff1",
                  caseId: "c1",
                  updatedAt: clock,
                  state: "PENDING",
                  case: { id: "c1", name: "Hồ sơ cần nhận", updatedAt: clock },
                },
              ]
            : url.includes("/admin/users")
              ? [{ id: "u2", username: "recipient" }]
              : url.endsWith("/u2/access-mode")
                ? {
                    id: "u2",
                    caseAccessMode: "INTERNAL",
                    caseAccessRevision: 3,
                    updatedAt: clock,
                  }
                : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
});
it("drills into the same queue with the dashboard server clock", async () => {
  render(
    <MemoryRouter>
      <CaseOperationsPage />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("link", { name: /Quá hạn.*2/ }),
  ).toHaveAttribute(
    "href",
    `/cases?governanceQueue=overdue&governanceClock=${encodeURIComponent(clock)}`,
  );
});
it("accepts an inbox handoff independently with both current versions", async () => {
  render(
    <MemoryRouter>
      <CaseOperationsPage />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "Hộp tiếp nhận" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Nhận Hồ sơ cần nhận" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/handoffs/handoff1/accept",
      expect.objectContaining({
        expectedUpdatedAt: clock,
        expectedAggregateUpdatedAt: clock,
        requestKey: expect.any(String),
      }),
    ),
  );
});
it("changes principal mode using User.write-scoped server permission and exact user revision", async () => {
  render(
    <MemoryRouter>
      <CaseOperationsPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("tab", { name: "Phạm vi tài khoản" }),
  );
  await waitFor(() => {
    const picker = screen.getByLabelText("Tài khoản cần quản lý phạm vi");
    expect(picker).toBeEnabled();
    expect(picker.querySelector('option[value=u2]')).not.toBeNull();
  });
  fireEvent.change(
    await screen.findByLabelText("Tài khoản cần quản lý phạm vi"),
    { target: { value: "u2" } },
  );
  fireEvent.change(await screen.findByLabelText("Chế độ truy cập vụ án"), {
    target: { value: "REPRESENTATION_ONLY" },
  });
  fireEvent.change(screen.getByLabelText("Lý do đổi phạm vi tài khoản"), {
    target: { value: "Chỉ truy cập hồ sơ đại diện được cấp" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ghi nhận phạm vi tài khoản" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/governance/principals/u2/access-mode",
      expect.objectContaining({
        caseAccessMode: "REPRESENTATION_ONLY",
        expectedUserUpdatedAt: clock,
        expectedCaseAccessRevision: 3,
      }),
    ),
  );
});
