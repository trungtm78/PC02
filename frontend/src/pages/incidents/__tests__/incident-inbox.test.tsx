import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IncidentInboxPage from "../IncidentInboxPage";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  edit: true,
}));
vi.mock("@/lib/api", () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({ canEdit: () => mocks.edit }),
}));
const row = {
  id: "h1",
  updatedAt: "2026-10-06T01:00:00Z",
  sentAt: "2026-10-06T00:00:00Z",
  toTeam: { name: "Tổ nhận" },
  incident: {
    id: "i1",
    code: "VV-UAT",
    name: "Nguồn tin",
    description: "Nội dung",
    updatedAt: "2026-10-06T02:00:00Z",
  },
};
describe("incident inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.edit = true;
    mocks.get.mockResolvedValue({ data: { data: [row], total: 1 } });
    mocks.post.mockResolvedValue({ data: { success: true } });
  });
  it("accepts with both versions and opens same dossier", async () => {
    render(<IncidentInboxPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận nhận" }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/vu-viec/i1"),
    );
    expect(mocks.post).toHaveBeenCalledWith(
      "/incidents/i1/handoffs/h1/accept",
      {
        expectedUpdatedAt: row.incident.updatedAt,
        expectedHandoffUpdatedAt: row.updatedAt,
      },
    );
  });
  it("read-only role cannot confirm receipt", async () => {
    mocks.edit = false;
    render(<IncidentInboxPage />);
    expect(
      await screen.findByRole("button", { name: "Xác nhận nhận" }),
    ).toBeDisabled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("failed receipt remains on inbox with error and supports reload", async () => {
    mocks.post.mockRejectedValue(new Error("Conflict"));
    render(<IncidentInboxPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận nhận" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
  it("empty scoped queue has clear message", async () => {
    mocks.get.mockResolvedValue({ data: { data: [], total: 0 } });
    render(<IncidentInboxPage />);
    expect(
      await screen.findByText(
        "Không có vụ việc chờ nhận trong phạm vi của bạn.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });
  it("pagination uses server offsets and can go back", async () => {
    mocks.get.mockResolvedValue({ data: { data: [row], total: 21 } });
    render(<IncidentInboxPage />);
    await screen.findByText("VV-UAT");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/incidents/handoffs/inbox", {
        params: { limit: 20, offset: 20 },
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Trang trước" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trang trước" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
  });
  it("load failure is visible", async () => {
    mocks.get.mockRejectedValue(new Error("Unavailable"));
    render(<IncidentInboxPage />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
