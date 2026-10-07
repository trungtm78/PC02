import { fireEvent, render, screen, waitFor } from "./render-governance";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CaseGovernanceFilters } from "../CaseGovernanceFilters";
import { governanceFilterParams } from "../governance-filters";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
const clock = "2026-10-06T01:00:00.000Z";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.endsWith("/capabilities")
        ? { caseAccessMode: "INTERNAL", enabled: true }
        : url.endsWith("/catalog")
          ? {
              actions: [
                { code: "CONCLUDE_INITIAL", label: "Kết luận điều tra" },
              ],
              additionalActions: ["VERIFY_PHASE"],
            }
          : { clock },
    },
  }));
});
function Probe() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Applied governance filters">
        {JSON.stringify(governanceFilterParams(params))}
      </output>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
    </>
  );
}
it("keeps phase, action history, decision, missing and queue filters in URL history at the same server clock", async () => {
  render(
    <MemoryRouter>
      <CaseGovernanceFilters />
      <Probe />
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByText("Lọc quản trị, quyết định và thời hạn"),
  );
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Thao tác đã ghi trong lịch sử")
        .querySelector("option[value=CONCLUDE_INITIAL]"),
    ).not.toBeNull(),
  );
  for (const [label, value] of Object.entries({
    "Giai đoạn điều tra": "UNKNOWN",
    "Thao tác đã ghi trong lịch sử": "CONCLUDE_INITIAL",
    "Số quyết định cần tìm": "Q-01",
    "Loại quyết định cần tìm": "Actual type",
    "Mã tài liệu nguồn quyết định": "doc1",
    "Ngày quyết định từ": "2026-10-01",
    "Ngày quyết định đến": "2026-10-06",
    "Dữ liệu cần bổ sung": "true",
    "Hàng đợi quản trị": "overdue",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await waitFor(() =>
    expect(
      screen.getByLabelText("Applied governance filters"),
    ).toHaveTextContent(clock),
  );
  const query = JSON.parse(
    screen.getByLabelText("Applied governance filters").textContent!,
  );
  expect(query).toEqual({
    investigationPhase: "UNKNOWN",
    actionCode: "CONCLUDE_INITIAL",
    decisionNumber: "Q-01",
    decisionType: "Actual type",
    decisionSourceDocumentId: "doc1",
    decisionDateFrom: "2026-10-01",
    decisionDateTo: "2026-10-06",
    missingData: true,
    governanceQueue: "overdue",
    governanceClock: clock,
  });
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText("Applied governance filters"),
    ).not.toHaveTextContent("governanceQueue"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Forward" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText("Applied governance filters"),
    ).toHaveTextContent(clock),
  );
  fireEvent.change(screen.getByLabelText("Hàng đợi quản trị"), {
    target: { value: "" },
  });
  expect(
    screen.getByLabelText("Applied governance filters"),
  ).not.toHaveTextContent("governanceClock");
  fireEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc quản trị" }));
  expect(screen.getByLabelText("Applied governance filters")).toHaveTextContent(
    "{}",
  );
});
it("does not offer internal field/queue filters to a representation-only principal", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { data: { caseAccessMode: "REPRESENTATION_ONLY", enabled: true } },
  });
  render(
    <MemoryRouter>
      <CaseGovernanceFilters />
      <Probe />
    </MemoryRouter>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(
    screen.queryByText("Lọc quản trị, quyết định và thời hạn"),
  ).not.toBeInTheDocument();
});
it("preserves invalid missing-data URL text for authoritative server rejection rather than guessing false", () => {
  expect(
    governanceFilterParams(new URLSearchParams("missingData=UNKNOWN")),
  ).toEqual({ missingData: "UNKNOWN" });
  expect(
    governanceFilterParams(new URLSearchParams("missingData=false")),
  ).toEqual({ missingData: false });
});
