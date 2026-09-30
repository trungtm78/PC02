/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import MonthlyReportWorkspacePage from "../MonthlyReportWorkspacePage";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const report = {
  id: "r1",
  status: "NEEDS_VERIFICATION",
  version: 1,
  periodStart: "2026-09-01T00:00:00.000Z",
  periodEnd: "2026-09-30T23:59:59.999Z",
  unitName: "PC02",
  summary: {
    appendixCount: 8,
    detailRowCount: 12,
    unresolvedIssueCount: 1,
    failedCheckCount: 0,
  },
  snapshot: {
    appendices: [
      {
        code: "PL01",
        kind: "DETAIL",
        rows: [
          {
            recordId: "i1",
            recordCode: "VV-001",
            cells: { crime: "Trộm cắp", summary: "Vụ việc A" },
            issues: [],
          },
        ],
        metrics: [],
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        code: `PL0${i + 2}`,
        kind: "DETAIL",
        rows: [],
        metrics: [],
      })),
      {
        code: "PL07",
        kind: "SUMMARY",
        rows: [],
        metrics: [{ key: "5", value: 3, contributionIds: ["x"] }],
      },
      {
        code: "PL08",
        kind: "SUMMARY",
        rows: [],
        metrics: [{ key: "5.case", value: 2, contributionIds: ["y"] }],
      },
    ],
  },
  checks: [],
  adjustments: [],
};

describe("MonthlyReportWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/reports/monthly-packages")
        return { data: [{ ...report, snapshot: undefined }] } as any;
      if (url === "/reports/monthly-packages/r1")
        return { data: report } as any;
      if (url.includes("/drilldown"))
        return {
          data: {
            value: 3,
            total: 1,
            page: 1,
            limit: 20,
            items: [
              {
                id: "c1",
                entityCode: "VV-001",
                label: "Vụ việc A",
                value: 1,
                ruleCode: "TDC_AT_PERIOD_END",
              },
            ],
          },
        } as any;
      throw new Error(url);
    });
  });

  it("shows all eight appendices and opens trace data without leaving the report", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={["/reports/monthly?reportId=r1&appendix=PL07"]}
      >
        <MonthlyReportWorkspacePage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("Báo cáo tháng 09/2026"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Phụ lục/ })).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: /Tồn cuối kỳ.*3/ }));
    expect(
      await screen.findByRole("dialog", { name: "Nguồn tạo số liệu" }),
    ).toBeInTheDocument();
    expect(screen.getByText("VV-001")).toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "Tìm trong nguồn số liệu" }),
      "VV-001",
    );
    await user.click(screen.getByRole("button", { name: "Tìm" }));
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        "/reports/monthly-packages/r1/drilldown",
        expect.objectContaining({
          params: expect.objectContaining({ q: "VV-001", page: 1, limit: 20 }),
        }),
      ),
    );
  });

  it("creates a report for the selected month and reloads the persisted package", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] } as any);
    vi.mocked(api.post).mockResolvedValue({ data: report } as any);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reports/monthly"]}>
        <MonthlyReportWorkspacePage />
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Lập báo cáo tháng" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/reports/monthly-packages",
        expect.objectContaining({ unitName: "PC02" }),
      ),
    );
  });
});
