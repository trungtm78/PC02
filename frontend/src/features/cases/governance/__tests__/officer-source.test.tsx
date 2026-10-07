import { render, screen, waitFor } from "./render-governance";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { OfficerLookup } from "../shared";
import { HandoffPanel } from "../HandoffPanel";
import { emptyWorkspace } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data:
        url === "/admin/users"
          ? [
              {
                id: "staff",
                username: "Verified staff",
                caseAccessMode: "INTERNAL",
                teams: [{ teamId: "t1", teamName: "Team 1", isLeader: true }],
              },
              {
                id: "representative",
                username: "Representative",
                caseAccessMode: "REPRESENTATION_ONLY",
                teams: [{ teamId: "t1", teamName: "Team 1" }],
              },
            ]
          : [],
    },
  }));
});
it("shares one cached authorized active officer source across business pickers", async () => {
  render(
    <>
      <OfficerLookup label="First assignment" value="" onChange={() => {}} />
      <OfficerLookup label="Second assignment" value="" onChange={() => {}} />
      <HandoffPanel
        caseId="c1"
        data={emptyWorkspace}
        refresh={async () => {}}
      />
    </>,
  );
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("First assignment")
        .querySelector("option[value=staff]"),
    ).not.toBeNull(),
  );
  expect(
    screen
      .getByLabelText("Second assignment")
      .querySelector("option[value=staff]"),
  ).not.toBeNull();
  expect(
    vi.mocked(api.get).mock.calls.filter(([url]) => url === "/admin/users"),
  ).toHaveLength(1);
  expect(api.get).toHaveBeenCalledWith("/admin/users", {
    params: { limit: 500, offset: 0, status: "active" },
  });
});
it("reports source lookup failure and disables business selection", async () => {
  vi.mocked(api.get).mockRejectedValue(new Error("Unavailable"));
  render(<OfficerLookup label="Assignment" value="" onChange={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Không tải được danh sách cán bộ.",
  );
  expect(screen.getByLabelText("Assignment")).toBeDisabled();
});
