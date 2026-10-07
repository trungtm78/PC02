import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "./render-governance";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { HandoffPanel } from "../HandoffPanel";
import { EvidencePanel } from "../EvidencePanel";
import { TasksPanel } from "../TasksPanel";
import { DisclosureVerifier } from "../DisclosureVerifier";
import CaseConfigurationPage from "../CaseConfigurationPage";
import CaseGovernancePage from "../CaseGovernancePage";
import { can, canHandoff, emptyWorkspace, type WorkspaceData } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const base: WorkspaceData = {
  ...emptyWorkspace,
  capabilities: {
    enabled: true,
    operate: true,
    canEdit: true,
    canDispatch: true,
    actorId: "actor1",
    caseAccessMode: "INTERNAL",
    custody: true,
  },
  snapshot: { caseId: "c1", updatedAt: version, handoffs: [], events: [] },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data:
        url === "/teams"
          ? [
              { id: "t1", name: "Team 1" },
              { id: "t2", name: "Team 2" },
            ]
          : url.includes("/admin/users")
            ? [
                {
                  id: "u1",
                  firstName: "Assigned user",
                  teams: [{ teamId: "t1" }, { teamId: "t2" }],
                },
              ]
            : url.startsWith("/documents")
              ? [{ id: "doc1", title: "Document 1", updatedAt: version }]
              : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
});
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it.each(["accept", "return", "cancel"])(
  "handles receipt %s with both versions and a recorded resolution",
  async (operation) => {
    render(
      <HandoffPanel
        caseId="c1"
        data={{
          ...base,
          capabilities: {
            ...base.capabilities,
            canEdit: false,
            pendingHandoff: true,
          },
          snapshot: {
            ...base.snapshot!,
            intakeStage: "CHO_NHAN",
            handoffs: [
              {
                id: "h1",
                state: "PENDING",
                updatedAt: version,
                sentById: "actor1",
                recipientId: "actor1",
                toTeamId: "t2",
                receiptFacts: {
                  receiptChecklist: [{ documentId: "doc1", present: false }],
                  shortcomings: "Source needs supplement",
                },
              },
            ],
          },
        }}
        refresh={async () => {}}
      />,
    );
    change("Ý kiến tiếp nhận h1", "Actual independent resolution");
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: {
          accept: "Xác nhận nhận hồ sơ",
          return: "Trả lại hồ sơ",
          cancel: "Hủy bàn giao",
        }[operation],
      }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/handoffs/h1/${operation}`,
        expect.objectContaining({
          expectedUpdatedAt: version,
          expectedAggregateUpdatedAt: version,
          reason: "Actual independent resolution",
        }),
      ),
    );
  },
);
it("assigns an active member within a selected team and keeps receipt facts structured", async () => {
  render(
    <HandoffPanel
      caseId="c1"
      data={{ ...base, capabilities: { ...base.capabilities, canEdit: false } }}
      refresh={async () => {}}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("Đội phụ trách").querySelector("option[value=t1]"),
    ).not.toBeNull(),
  );
  change("Đội phụ trách", "t1");
  change("Điều tra viên nhận phân công", "u1");
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận phân công" }));
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith(
      "/cases/c1/assign",
      expect.objectContaining({
        assignedTeamId: "t1",
        investigatorId: "u1",
        expectedUpdatedAt: version,
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Gửi bàn giao" })).toBeEnabled(),
  );
  change("Đội nhận hồ sơ", "t2");
  change("Người nhận được chỉ định", "u1");
  fireEvent.click(screen.getByLabelText("Document 1"));
  change("Ghi chú kiểm kê doc1", "Observed missing certification");
  fireEvent.click(screen.getByLabelText("Document 1"));
  fireEvent.click(screen.getByLabelText("Document 1"));
  fireEvent.click(screen.getByRole("button", { name: "Gửi bàn giao" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/handoffs",
      expect.objectContaining({
        recipientId: "u1",
        receiptChecklist: [
          {
            documentId: "doc1",
            expectedDocumentUpdatedAt: version,
            present: true,
          },
        ],
      }),
    ),
  );
});
const pendingData: WorkspaceData = {
  ...base,
  capabilities: {
    ...base.capabilities,
    enabled: false,
    canEdit: false,
    pendingHandoff: true,
  },
  snapshot: {
    ...base.snapshot!,
    intakeStage: "CHO_NHAN",
    handoffs: [
      {
        id: "h1",
        state: "PENDING",
        updatedAt: version,
        sentById: "actor1",
        recipientId: "actor1",
      },
    ],
  },
};
it("requires current case/aggregate versions and designated recipient without unlocking ordinary edits", () => {
  expect(can(pendingData, "operate", true)).toBe(false);
  const enabled = {
    ...pendingData,
    capabilities: { ...pendingData.capabilities, enabled: true },
  };
  expect(can(enabled, "operate", true)).toBe(false);
  const row = pendingData.snapshot!.handoffs[0];
  expect(canHandoff(enabled, "accept", { ...row, recipientId: "other" })).toBe(
    false,
  );
  expect(canHandoff(enabled, "return", { ...row, updatedAt: undefined })).toBe(
    false,
  );
  expect(canHandoff({ ...enabled, snapshot: null }, "cancel", row)).toBe(false);
  expect(canHandoff(enabled, "accept", { ...row, state: "RETURNED" })).toBe(
    false,
  );
  expect(
    canHandoff(
      {
        ...enabled,
        snapshot: { ...enabled.snapshot!, intakeStage: "DA_NHAN" },
      },
      "cancel",
      row,
    ),
  ).toBe(false);
  expect(canHandoff(enabled, "send")).toBe(false);
  expect(canHandoff(enabled, "assign")).toBe(false);
});
it.each(["return", "cancel"])(
  "clears an existing pending handoff by %s while the feature is off",
  async (operation) => {
    render(
      <HandoffPanel caseId="c1" data={pendingData} refresh={async () => {}} />,
    );
    change("Ý kiến tiếp nhận h1", "Recorded clearing reason");
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByRole("button", { name: "Xác nhận nhận hồ sơ" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi bàn giao" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ghi nhận phân công" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: operation === "return" ? "Trả lại hồ sơ" : "Hủy bàn giao",
      }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/handoffs/h1/${operation}`,
        expect.objectContaining({
          expectedUpdatedAt: version,
          expectedAggregateUpdatedAt: version,
          reason: "Recorded clearing reason",
        }),
      ),
    );
  },
);
it.each([
  { operate: false },
  { caseAccessMode: "REPRESENTATION_ONLY" as const },
  { actorId: "other", canDispatch: false },
])(
  "keeps pending commands disabled without current business authority %j",
  async (caps) => {
    render(
      <HandoffPanel
        caseId="c1"
        data={{
          ...pendingData,
          capabilities: { ...pendingData.capabilities, ...caps },
        }}
        refresh={async () => {}}
      />,
    );
    change("Ý kiến tiếp nhận h1", "Recorded clearing reason");
    await act(async () => {
      await Promise.resolve();
    });
    for (const name of [
      "Xác nhận nhận hồ sơ",
      "Trả lại hồ sơ",
      "Hủy bàn giao",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(api.post).not.toHaveBeenCalled();
  },
);
it("requires dispatch authority for new handoffs and assignment even with ordinary edit permission", async () => {
  render(
    <HandoffPanel
      caseId="c1"
      data={{
        ...base,
        capabilities: { ...base.capabilities, canDispatch: false },
      }}
      refresh={async () => {}}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "Gửi bàn giao" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Ghi nhận phân công" }),
  ).toBeDisabled();
});
it("registers a derivative using the exact immutable parent SHA and verifies original bytes", async () => {
  render(
    <EvidencePanel
      caseId="c1"
      data={{
        ...base,
        evidence: {
          assets: [
            {
              id: "asset1",
              documentId: "doc1",
              sha256: "a".repeat(64),
              kind: "ORIGINAL",
              caseId: "c1",
            },
          ],
        },
      }}
      refresh={async () => {}}
    />,
  );
  change("Phiên bản nguồn dẫn xuất", "asset1");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Tài liệu dẫn xuất đã tải lên")
        .querySelector("option[value=doc1]"),
    ).not.toBeNull(),
  );
  change("Tài liệu dẫn xuất đã tải lên", "doc1");
  change("Công cụ tạo dẫn xuất", "Redaction tool");
  change("Phiên bản công cụ", "1.0");
  fireEvent.click(screen.getByRole("button", { name: "Đăng ký bản dẫn xuất" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/assets/asset1/derivative",
      expect.objectContaining({
        documentId: "doc1",
        tool: "Redaction tool",
        toolVersion: "1.0",
        sourceHash: "a".repeat(64),
      }),
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Kiểm chứng byte bản asset1" }),
    ).toBeEnabled(),
  );
  vi.mocked(api.post).mockResolvedValueOnce({
    data: { data: { integrityVerified: true, sha256: "a".repeat(64) } },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Kiểm chứng byte bản asset1" }),
  );
  expect(
    await screen.findByText(/Đã kiểm tra byte và SHA/),
  ).toBeInTheDocument();
});
it("updates a task status, assignee, due time and detail without changing immutable source identity", async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) =>
    args[0] === "/cases/governance/tasks"
      ? {
          data: {
            data: [
              {
                id: "task1",
                caseId: "c1",
                updatedAt: version,
                type: "MISSING_DATA",
                sourceId: "source1",
                status: "OPEN",
                payload: {
                  title: "Existing work",
                  description: "Original detail",
                },
              },
            ],
          },
        }
      : get(...args),
  );
  render(<TasksPanel caseId="c1" data={base} refresh={async () => {}} />);
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Công việc cần cập nhật")
        .querySelector("option[value=task1]"),
    ).not.toBeNull(),
  );
  change("Công việc cần cập nhật", "task1");
  change("Nội dung công việc", "Updated work");
  change("Chi tiết công việc", "Checked actual sources");
  change("Hạn hoàn thành công việc", "2026-10-07T09:00");
  change("Trạng thái công việc", "IN_PROGRESS");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Người được giao công việc")
        .querySelector("option[value=u1]"),
    ).not.toBeNull(),
  );
  change("Người được giao công việc", "u1");
  fireEvent.click(screen.getByRole("button", { name: "Cập nhật công việc" }));
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith(
      "/cases/c1/governance/tasks/task1",
      expect.objectContaining({
        type: "MISSING_DATA",
        sourceId: "source1",
        assigneeId: "u1",
        status: "IN_PROGRESS",
        expectedAggregateUpdatedAt: version,
        payload: {
          title: "Updated work",
          description: "Checked actual sources",
        },
      }),
    ),
  );
});
it("runs the offline verifier against a selected local artifact and reports a bad trusted hash", async () => {
  render(<DisclosureVerifier />);
  const file = new File(["{}"], "bundle.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => "{}" });
  fireEvent.change(screen.getByLabelText("Gói cung cấp đã tải"), {
    target: { files: [file] },
  });
  change("SHA-256 bản duyệt từ nguồn tin cậy riêng", "wrong");
  fireEvent.click(
    screen.getByRole("button", { name: "Kiểm chứng manifest và byte" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Không đạt");
});
it("mounts the real parameterized governance route and displays server pins", async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.endsWith("/governance")
        ? {
            ...base.snapshot,
            governanceRuleVersionId: "rule-pin",
            fieldDefinitionVersionId: "field-pin",
          }
        : url.endsWith("/capabilities")
          ? base.capabilities
          : url.endsWith("/actions")
            ? { requests: [], decisions: [] }
            : url.endsWith("/catalog")
              ? { actions: [], additionalActions: [] }
              : url.endsWith("/rules")
                ? []
                : url.endsWith("/evidence-governance")
                  ? {}
                  : [],
    },
  }));
  render(
    <MemoryRouter initialEntries={["/cases/c1/governance"]}>
      <Routes>
        <Route path="/cases/:id/governance" element={<CaseGovernancePage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Quy tắc ghim: rule-pin/)).toBeInTheDocument();
});
it.each([
  ["DRAFT", "Kiểm tra cấu hình", "validate"],
  ["VALIDATED", "Thẩm định độc lập cấu hình", "review"],
  ["REVIEWED", "Công bố bản đã thẩm định", "publish"],
])(
  "handles configuration %s lifecycle with the exact revision",
  async (status, button, operation) => {
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        data: url.endsWith("/capabilities")
          ? {
              enabled: true,
              operate: true,
              review: true,
              publish: true,
              actorId: "reviewer",
              caseAccessMode: "INTERNAL",
            }
          : url.endsWith("/catalog")
            ? { actions: [], additionalActions: [] }
            : url.endsWith("/rules")
              ? [
                  {
                    id: "config1",
                    code: "default",
                    status,
                    revision: 3,
                    updatedAt: version,
                    authorId: "maker",
                    definition: { actions: [] },
                  },
                ]
              : [],
      },
    }));
    render(
      <MemoryRouter>
        <CaseConfigurationPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen
          .getByLabelText("Phiên bản cấu hình cần xem")
          .querySelector("option[value=config1]"),
      ).not.toBeNull(),
    );
    change("Phiên bản cấu hình cần xem", "config1");
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/governance/rules/config1/${operation}`,
        { expectedUpdatedAt: version, expectedRevision: 3 },
      ),
    );
  },
);
