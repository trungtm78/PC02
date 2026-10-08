import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "./render-governance";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import inventory from "../../../../../../docs/requirements/case-governance/action-inventory.json";
import { api } from "@/lib/api";
import { LegalActionsPanel } from "../LegalActionsPanel";
import { emptyWorkspace, type WorkspaceData } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const decision = {
  type: "Actual decision",
  number: "Q-01",
  date: "2026-10-01",
  effectiveDate: "2026-10-02",
  issuer: "Issuing authority",
  signatory: "Actual signatory",
  legalBasis: "Reviewed basis",
  sourceDocumentId: "doc1",
};
const extra = [
  "VERIFY_PHASE",
  "SPLIT_CASE",
  "CORRECT_DECISION",
  "LINK_RELATED",
  "LINK_SOURCE",
  "CLASSIFY_SENSITIVITY",
];
const actions = [
  ...inventory.rows,
  ...extra.map((code) => ({ code, label: code })),
];
function data(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    ...emptyWorkspace,
    capabilities: {
      enabled: true,
      canEdit: true,
      operate: true,
      review: true,
      actorId: "reviewer",
      caseAccessMode: "INTERNAL",
    },
    snapshot: { caseId: "c1", updatedAt: version, handoffs: [], events: [] },
    actions,
    readiness: actions.map((action) => ({
      code: action.code,
      allowed: true,
      ready: false,
      reasons: ["Phải thẩm định bản thực tế"],
      requiredFields: [],
      ruleVersionIds: ["rule1"],
    })),
    ...overrides,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.includes("/actions/capabilities")
        ? {
            actions: actions.map((action) => ({
              code: action.code,
              allowed: true,
              ready: true,
              reasons: [],
              requiredFields: [],
              ruleVersionIds: ["rule1"],
            })),
          }
        : url.startsWith("/documents")
          ? [{ id: "doc1", title: "Actual decision", updatedAt: version }]
          : url === "/teams"
            ? [{ id: "team1", name: "Authorized team" }]
            : url.startsWith("/cases?")
              ? [
                  {
                    id: "target1",
                    name: "Authorized target",
                    updatedAt: version,
                  },
                ]
              : url.includes("/subjects")
                ? [
                    {
                      id: "subject1",
                      name: "Subject selected for allocation",
                      updatedAt: version,
                    },
                  ]
                : url.includes("/evidences")
                  ? [
                      {
                        id: "physical1",
                        name: "Physical evidence selected",
                        updatedAt: version,
                      },
                    ]
                  : url.startsWith("/incidents")
                    ? [
                        {
                          id: "incident1",
                          name: "Authorized source",
                          updatedAt: version,
                        },
                      ]
                    : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
});
function mount(value = data()) {
  render(
    <MemoryRouter>
      <LegalActionsPanel caseId="c1" data={value} refresh={async () => {}} />
    </MemoryRouter>,
  );
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function fillDecision() {
  for (const [label, value] of Object.entries({
    "Loại quyết định": decision.type,
    "Số quyết định": decision.number,
    "Ngày quyết định": decision.date,
    "Ngày có hiệu lực": decision.effectiveDate,
    "Cơ quan ban hành": decision.issuer,
    "Người ký": decision.signatory,
    "Căn cứ pháp lý": decision.legalBasis,
  }))
    change(label, value);
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Tài liệu quyết định gốc")
        .querySelector("option[value=doc1]"),
    ).not.toBeNull(),
  );
  change("Tài liệu quyết định gốc", "doc1");
}

it.each(inventory.rows)(
  "drafts legacy action $legacyId $code with actual structured decision facts",
  async (action) => {
    mount();
    change("Thao tác nghiệp vụ", action.code);
    await fillDecision();
    if (action.code.includes("MERGE")) {
      await waitFor(() =>
        expect(
          screen
            .getByLabelText("Vụ án đích được phép truy cập")
            .querySelector("option[value=target1]"),
        ).not.toBeNull(),
      );
      change("Vụ án đích được phép truy cập", "target1");
    }
    if (action.code.includes("TRANSFER"))
      change("Cơ quan nhận chuyển pháp lý", "Actual receiving agency");
    if (action.code.includes("EXPIR"))
      change("Kết quả đánh giá hết thời hạn", "EXPIRED_VERIFIED");
    if (
      [
        "RESTORE_SUSPENDED",
        "SUPPLEMENT_AFTER_CONCLUSION",
        "REINVESTIGATE_AFTER_CONCLUSION",
        "REINVESTIGATE_AFTER_SUPPLEMENT",
      ].includes(action.code)
    ) {
      change("Ngày phục hồi thực tế", "2026-10-02");
      change("Chất lượng ngày phục hồi thực tế", "VERIFIED");
      change("Ngày nhận hồ sơ", "2026-10-03");
      change("Chất lượng ngày nhận hồ sơ", "COMPLETE");
      change("Ngày nhận yêu cầu", "2026-10-04");
      change("Chất lượng ngày nhận yêu cầu", "VERIFIED");
      change("Mức độ nghiêm trọng", "NGHIEM_TRONG");
      change("Cơ quan yêu cầu", "VKS");
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu dự thảo quyết định" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/cases/c1/actions",
        expect.objectContaining({
          actionCode: action.code,
          ruleVersionId: "rule1",
          expectedUpdatedAt: version,
          payload: expect.objectContaining({ decision }),
        }),
      ),
    );
  },
);

it.each([
  ["DRAFT", "Gửi thẩm định quyết định", "submit", undefined],
  ["SUBMITTED", "Phê duyệt quyết định", "review", true],
  ["SUBMITTED", "Từ chối quyết định", "review", false],
  ["APPROVED", "Thực hiện quyết định đã phê duyệt", "execute", undefined],
] as const)(
  "handles independent legal %s transition with exact Case/request revision",
  async (status, button, operation, approve) => {
    const request = {
      id: "r1",
      actionCode: "CONCLUDE_INITIAL",
      ruleVersionId: "rule1",
      revision: 3,
      status,
      updatedAt: version,
      authorId: "maker",
      payload: { decision },
    };
    mount(data({ requests: [request] }));
    change("Dự thảo cần xử lý", "r1");
    change("Ý kiến thẩm định quyết định", "Reviewed actual source");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: button })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/actions/r1/${operation}`,
        expect.objectContaining({
          expectedUpdatedAt: version,
          expectedAggregateUpdatedAt: version,
          expectedRevision: 3,
          ...(operation === "review" && {
            approve,
            note: "Reviewed actual source",
          }),
        }),
      ),
    );
  },
);

it("rejects self-review in the operator UI", async () => {
  mount(
    data({
      requests: [
        {
          id: "r1",
          actionCode: "CONCLUDE_INITIAL",
          ruleVersionId: "rule1",
          revision: 2,
          status: "SUBMITTED",
          updatedAt: version,
          authorId: "reviewer",
          payload: { decision },
        },
      ],
    }),
  );
  change("Dự thảo cần xử lý", "r1");
  change("Ý kiến thẩm định quyết định", "Attempt self review");
  expect(
    screen.getByRole("button", { name: "Phê duyệt quyết định" }),
  ).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.resolve();
  });
});
it("revises payload and strips all server-owned source/allocation snapshots", async () => {
  mount(
    data({
      requests: [
        {
          id: "r1",
          actionCode: "CONCLUDE_INITIAL",
          ruleVersionId: "rule1",
          revision: 2,
          status: "APPROVED",
          updatedAt: version,
          authorId: "maker",
          payload: {
            decision,
            sourceSnapshot: { protected: "server-only" },
            allocationSnapshot: {},
            utdtSourceSnapshot: {},
          },
        },
      ],
    }),
  );
  change("Dự thảo cần xử lý", "r1");
  change("Số quyết định", "Q-02");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Tài liệu quyết định gốc")
        .querySelector("option[value=doc1]"),
    ).not.toBeNull(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu sửa dự thảo và hủy phê duyệt cũ" }),
  );
  await waitFor(() => expect(api.patch).toHaveBeenCalled());
  const body = vi.mocked(api.patch).mock.calls[0][1];
  expect(body).toHaveProperty("payload.decision.number", "Q-02");
  expect(body).not.toHaveProperty("payload.sourceSnapshot");
  expect(body).not.toHaveProperty("payload.allocationSnapshot");
  expect(body).not.toHaveProperty("payload.utdtSourceSnapshot");
});
it("links an existing authorized source with its precise version and no phantom create", async () => {
  mount();
  change("Thao tác nghiệp vụ", "LINK_SOURCE");
  await fillDecision();
  change("Loại nguồn cần liên kết", "INCIDENT");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Nguồn hiện có được phép truy cập")
        .querySelector("option[value=incident1]"),
    ).not.toBeNull(),
  );
  change("Nguồn hiện có được phép truy cập", "incident1");
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu dự thảo quyết định" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/actions",
      expect.objectContaining({
        payload: expect.objectContaining({
          sourceType: "INCIDENT",
          sourceId: "incident1",
          sourceUpdatedAt: version,
        }),
      }),
    ),
  );
  expect(
    vi
      .mocked(api.post)
      .mock.calls.every(([path]) => path === "/cases/c1/actions"),
  ).toBe(true);
});
it("allocates selected concrete source parts into a split draft without moving them", async () => {
  mount();
  change("Thao tác nghiệp vụ", "SPLIT_CASE");
  await fillDecision();
  change("Tên hồ sơ tách", "Split case");
  change("Tội danh hồ sơ tách", "Verified crime");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Đội quản lý hồ sơ tách")
        .querySelector("option[value=team1]"),
    ).not.toBeNull(),
  );
  change("Đội quản lý hồ sơ tách", "team1");
  change("Căn cứ phân bổ", "Reviewed allocation basis");
  fireEvent.click(
    await screen.findByLabelText(/Subject selected for allocation/),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu dự thảo quyết định" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/actions",
      expect.objectContaining({
        payload: expect.objectContaining({
          newCase: {
            name: "Split case",
            crime: "Verified crime",
            assignedTeamId: "team1",
            allocationBasis: "Reviewed allocation basis",
          },
          allocation: {
            subjects: [{ id: "subject1", expectedUpdatedAt: version }],
          },
        }),
      }),
    ),
  );
});
