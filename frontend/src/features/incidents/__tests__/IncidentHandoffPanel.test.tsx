import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { FeatureFlagsContext } from "@/lib/features/featureFlagsContextObject";
import { IncidentHandoffPanel } from "../IncidentHandoffPanel";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({ canDispatch: true, canEdit: () => true }),
}));
vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chọn</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/teams"
        ? { data: [{ id: "team-id", name: "Tổ nhận", isActive: true }] }
        : { data: { data: [] } },
    ),
  );
  post.mockResolvedValue({ data: { success: true } });
});
const wrap = (onChanged = vi.fn(), enabled = true, intakeStage = "PHAN_LOAI") =>
  render(
    <FeatureFlagsContext.Provider
      value={
        { flags: new Map([["INCIDENT_INTAKE_HANDOFF", { enabled }]]) } as never
      }
    >
      <IncidentHandoffPanel
        incidentId="i1"
        updatedAt="2026-10-05T00:00:00Z"
        intakeStage={intakeStage}
        onChanged={onChanged}
      />
    </FeatureFlagsContext.Provider>,
  );
describe("Bàn giao trên màn chi tiết hiện có", () => {
  it("gửi ID tổ, phiên bản hồ sơ, khóa retry và gọi refresh sau thành công", async () => {
    const changed = vi.fn();
    wrap(changed);
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Tổ nhận" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "team-id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Giao hồ sơ" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/incidents/i1/handoffs",
      expect.objectContaining({
        toTeamId: "team-id",
        expectedUpdatedAt: "2026-10-05T00:00:00Z",
        requestKey: expect.any(String),
      }),
    );
  });
  it("thất bại cho phép thử lại cùng khóa, không refresh hoặc chế thành công", async () => {
    post.mockRejectedValue(new Error("network"));
    const changed = vi.fn();
    wrap(changed);
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Tổ nhận" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "team-id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Giao hồ sơ" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Giao hồ sơ" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[0][1].requestKey).toBe(
      post.mock.calls[1][1].requestKey,
    );
    expect(changed).not.toHaveBeenCalled();
  });
  it("flag OFF không cho gửi lượt giao mới", async () => {
    await act(async () => {
      wrap(vi.fn(), false);
    });
    expect(
      screen.queryByRole("button", { name: "Giao hồ sơ" }),
    ).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
  it("flag OFF vẫn hủy lượt chờ với lý do và cả hai phiên bản", async () => {
    get.mockResolvedValue({
      data: {
        data: [
          {
            id: "h1",
            state: "PENDING",
            toTeamId: "team-id",
            sentAt: "2026-10-05T00:00:00Z",
            updatedAt: "2026-10-05T01:00:00Z",
          },
        ],
      },
    });
    const changed = vi.fn();
    wrap(changed, false, "CHO_NHAN");
    const cancel = await screen.findByRole("button", {
      name: "Hủy lượt giao đang chờ",
    });
    expect(cancel).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do hủy giao"), {
      target: { value: "Sai tổ nhận" },
    });
    fireEvent.click(cancel);
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/incidents/i1/handoffs/h1/cancel", {
      expectedUpdatedAt: "2026-10-05T00:00:00Z",
      expectedHandoffUpdatedAt: "2026-10-05T01:00:00Z",
      reason: "Sai tổ nhận",
    });
  });
  it("lịch sử đã nhận/đã hủy giữ nhãn riêng", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/teams"
          ? { data: [] }
          : {
              data: {
                data: [
                  {
                    id: "h1",
                    state: "ACCEPTED",
                    sentAt: "2026-10-05T00:00:00Z",
                  },
                  {
                    id: "h2",
                    state: "CANCELLED",
                    sentAt: "2026-10-05T00:00:00Z",
                  },
                ],
              },
            },
      ),
    );
    wrap(vi.fn(), true, "DA_NHAN");
    await screen.findByText(/— Đã hủy giao/);
    expect(screen.getByText("Đã nhận xử lý")).toBeInTheDocument();
    expect(screen.getByText(/— Đã nhận/)).toBeInTheDocument();
  });
  it("tải tổ hoặc lịch sử lỗi phải báo rõ", async () => {
    get.mockRejectedValue(new Error("Unavailable"));
    wrap();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
