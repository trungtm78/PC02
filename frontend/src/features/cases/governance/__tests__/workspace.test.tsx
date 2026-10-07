import { render, screen, fireEvent, waitFor } from "./render-governance";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CaseGovernanceWorkspace } from "../CaseGovernanceWorkspace";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const capability = {
  actorId: "actor1",
  enabled: true,
  operate: true,
  review: true,
  publish: true,
  share: true,
  custody: true,
  dispose: true,
  canEdit: true,
  canDispatch: true,
  caseAccessMode: "INTERNAL",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data:
        url.endsWith("/capabilities") && !url.includes("/actions/")
          ? capability
          : url.endsWith("/governance")
            ? {
                caseId: "c1",
                updatedAt: version,
                handoffs: [],
                events: [],
                investigationPhase: null,
              }
            : url.includes("/actions/capabilities")
              ? {
                  actions: [
                    {
                      code: "RESTORE_CASE",
                      allowed: true,
                      ready: false,
                      reasons: ["Thiếu quyết định đã phê duyệt"],
                      requiredFields: [],
                      ruleVersionIds: ["rule1"],
                    },
                  ],
                }
              : url.endsWith("/catalog")
                ? {
                    actions: [
                      {
                        code: "RESTORE_CASE",
                        label: "Phục hồi điều tra",
                        legacyId: "restore-case",
                      },
                    ],
                    additionalActions: [],
                  }
                : url.endsWith("/actions")
                  ? { requests: [], decisions: [] }
                  : url.endsWith("/evidence-governance")
                    ? {
                        assets: [],
                        custody: [],
                        packets: [],
                        holds: [],
                        representationGrants: [],
                        retentionPolicies: [],
                        dispositions: [],
                      }
                    : url.endsWith("/rules") ||
                        url.endsWith("/field-definitions")
                      ? []
                      : url.startsWith("/teams")
                        ? [{ id: "t2", name: "Đội nhận" }]
                        : url.startsWith("/admin/users")
                          ? [
                              {
                                id: "u2",
                                firstName: "Người nhận",
                                username: "recipient",
                              },
                            ]
                          : url.startsWith("/documents")
                            ? [
                                {
                                  id: "doc1",
                                  title: "Quyết định gốc",
                                  updatedAt: version,
                                },
                              ]
                            : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: { id: "draft1" } } });
});
function mount() {
  return render(
    <MemoryRouter>
      <CaseGovernanceWorkspace caseId="c1" />
    </MemoryRouter>,
  );
}
it("uses a dedicated handoff command and refreshes current versions after sending", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Tiếp nhận và phân công" }),
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("Đội nhận hồ sơ").querySelector("option[value=t2]"),
    ).not.toBeNull(),
  );
  fireEvent.change(await screen.findByLabelText("Đội nhận hồ sơ"), {
    target: { value: "t2" },
  });
  fireEvent.change(screen.getByLabelText("Lý do bàn giao"), {
    target: { value: "Bàn giao có kiểm kê" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi bàn giao" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/handoffs",
      expect.objectContaining({
        toTeamId: "t2",
        expectedUpdatedAt: version,
        requestKey: expect.any(String),
        reason: "Bàn giao có kiểm kê",
      }),
    ),
  );
  expect(
    vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => url === "/cases/c1/governance").length,
  ).toBeGreaterThan(1);
});
it("shows server legal readiness and requires actual decision facts for draft creation", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Quyết định và tiến trình" }),
  );
  fireEvent.change(screen.getByLabelText("Thao tác nghiệp vụ"), {
    target: { value: "RESTORE_CASE" },
  });
  expect(
    await screen.findByText("Thiếu quyết định đã phê duyệt"),
  ).toBeInTheDocument();
  for (const [label, value] of Object.entries({
    "Loại quyết định": "Phục hồi",
    "Số quyết định": "QĐ-01",
    "Ngày quyết định": "2026-10-01",
    "Ngày có hiệu lực": "2026-10-02",
    "Cơ quan ban hành": "CQĐT",
    "Người ký": "Người ký thực tế",
    "Căn cứ pháp lý": "Văn bản đã kiểm chứng",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(await screen.findByLabelText("Tài liệu quyết định gốc"), {
    target: { value: "doc1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu dự thảo quyết định" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/actions",
      expect.objectContaining({
        actionCode: "RESTORE_CASE",
        ruleVersionId: "rule1",
        expectedUpdatedAt: version,
        payload: expect.objectContaining({
          decision: expect.objectContaining({
            sourceDocumentId: "doc1",
            date: "2026-10-01",
          }),
        }),
      }),
    ),
  );
});
it("keeps commands unavailable when server capability is absent", async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) =>
    args[0] === "/cases/c1/capabilities"
      ? {
          data: { data: { ...capability, operate: false, canDispatch: false } },
        }
      : get(...args),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Tiếp nhận và phân công" }),
  );
  expect(screen.getByRole("button", { name: "Gửi bàn giao" })).toBeDisabled();
});

it("registers an owned document as an immutable original", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Chứng cứ và giao nhận" }),
  );
  fireEvent.change(await screen.findByLabelText("Tài liệu gốc cần đăng ký"), {
    target: { value: "doc1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Đăng ký bản gốc bất biến" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/assets/register",
      expect.objectContaining({
        documentId: "doc1",
        expectedUpdatedAt: version,
        requestKey: expect.any(String),
      }),
    ),
  );
});

it("creates preservation holds without an automatic read embargo", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Bảo toàn và lưu giữ" }),
  );
  fireEvent.change(screen.getByLabelText("Lý do bảo toàn"), {
    target: { value: "Giữ phục vụ điều tra" },
  });
  fireEvent.change(screen.getByLabelText("Căn cứ bảo toàn"), {
    target: { value: "Quyết định bảo toàn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận bảo toàn" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/holds",
      expect.objectContaining({
        reason: "Giữ phục vụ điều tra",
        basis: "Quyết định bảo toàn",
        expectedUpdatedAt: version,
      }),
    ),
  );
  expect(screen.getByText(/Bảo toàn ngăn xử lý hủy/)).toBeInTheDocument();
});

it("reuses the request key when the same handoff fails and is retried", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error("Mạng gián đoạn"));
  mount();
  await waitFor(() =>
    expect(
      screen.getByLabelText("Đội nhận hồ sơ").querySelector("option[value=t2]"),
    ).not.toBeNull(),
  );
  fireEvent.change(await screen.findByLabelText("Đội nhận hồ sơ"), {
    target: { value: "t2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi bàn giao" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Mạng gián đoạn");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Gửi bàn giao" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Gửi bàn giao" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  const [first, second] = vi.mocked(api.post).mock.calls;
  expect((first[1] as { requestKey: string }).requestKey).toEqual(
    (second[1] as { requestKey: string }).requestKey,
  );
});

it("creates a reviewed retention draft from structured civil facts", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Bảo toàn và lưu giữ" }),
  );
  fireEvent.change(screen.getByLabelText("Bảo quản đến"), {
    target: { value: "2027-10-01T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Căn cứ thời hạn lưu giữ"), {
    target: { value: "Chính sách được thẩm định" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo lưu giữ" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/retention",
      expect.objectContaining({
        preserveUntil: expect.stringContaining("2027-10-01"),
        basis: "Chính sách được thẩm định",
      }),
    ),
  );
});

it("creates an exact-version disclosure packet with an explicit recipient and expiry", async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) =>
    args[0].endsWith("/evidence-governance")
      ? {
          data: {
            data: {
              assets: [
                {
                  id: "asset1",
                  documentId: "doc1",
                  sha256: "a".repeat(64),
                  kind: "ORIGINAL",
                },
              ],
              packets: [],
            },
          },
        }
      : get(...args),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Gói cung cấp và kiểm chứng" }),
  );
  fireEvent.change(await screen.findByLabelText("Người nhận gói cung cấp"), {
    target: { value: "u2" },
  });
  fireEvent.change(screen.getByLabelText("Mục đích cung cấp"), {
    target: { value: "Cung cấp theo yêu cầu được duyệt" },
  });
  fireEvent.change(screen.getByLabelText("Căn cứ cung cấp"), {
    target: { value: "Căn cứ hợp lệ" },
  });
  fireEvent.change(screen.getByLabelText("Thời điểm hết quyền tải"), {
    target: { value: "2027-10-01T09:00" },
  });
  fireEvent.click(screen.getByLabelText("Chọn phiên bản asset1"));
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu dự thảo gói cung cấp" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/packets",
      expect.objectContaining({
        recipientId: "u2",
        purpose: "Cung cấp theo yêu cầu được duyệt",
        items: [{ assetVersionId: "asset1" }],
        expiresAt: expect.stringContaining("2027-10-01"),
        expectedUpdatedAt: version,
      }),
    ),
  );
});

it("creates a time-bound representation grant with selected capabilities only", async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) =>
    args[0].includes("/lawyers")
      ? {
          data: {
            data: [
              {
                id: "lawyer1",
                fullName: "Luật sư kiểm thử",
                subjectId: "subject1",
              },
            ],
          },
        }
      : get(...args),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Đại diện và quyền truy cập" }),
  );
  fireEvent.change(await screen.findByLabelText("Luật sư đại diện"), {
    target: { value: "lawyer1" },
  });
  fireEvent.change(await screen.findByLabelText("Tài khoản được cấp quyền"), {
    target: { value: "u2" },
  });
  fireEvent.change(screen.getByLabelText("Quyền đại diện bắt đầu"), {
    target: { value: "2026-10-01T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Quyền đại diện kết thúc"), {
    target: { value: "2027-10-01T09:00" },
  });
  fireEvent.click(screen.getByLabelText("Xem chi tiết"));
  fireEvent.click(
    screen.getByRole("button", { name: "Cấp quyền đại diện theo hồ sơ" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/representations",
      expect.objectContaining({
        lawyerId: "lawyer1",
        subjectId: "subject1",
        granteeId: "u2",
        capabilities: ["view"],
      }),
    ),
  );
});

it("assigns a dated governance task with a version and internal payload", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Công việc và lịch sử" }),
  );
  fireEvent.change(screen.getByLabelText("Loại công việc"), {
    target: { value: "MISSING_DATA" },
  });
  fireEvent.change(screen.getByLabelText("Mã nguồn công việc"), {
    target: { value: "missing1" },
  });
  fireEvent.change(screen.getByLabelText("Nội dung công việc"), {
    target: { value: "Xác minh ngày nhận hồ sơ" },
  });
  fireEvent.change(await screen.findByLabelText("Người được giao công việc"), {
    target: { value: "u2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Giao công việc" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/governance/tasks",
      expect.objectContaining({
        type: "MISSING_DATA",
        sourceId: "missing1",
        assigneeId: "u2",
        payload: expect.objectContaining({ title: "Xác minh ngày nhận hồ sơ" }),
        expectedUpdatedAt: version,
      }),
    ),
  );
});

it("pins the receipt checklist document revision and records shortcomings on handoff", async () => {
  mount();
  await waitFor(() =>
    expect(
      screen.getByLabelText("Đội nhận hồ sơ").querySelector("option[value=t2]"),
    ).not.toBeNull(),
  );
  fireEvent.change(await screen.findByLabelText("Đội nhận hồ sơ"), {
    target: { value: "t2" },
  });
  fireEvent.click(await screen.findByLabelText("Quyết định gốc"));
  fireEvent.change(screen.getByLabelText("Kiểm kê hiện diện doc1"), {
    target: { value: "false" },
  });
  fireEvent.change(
    screen.getByLabelText("Kiểm kê tài liệu · thiếu sót cần bổ sung"),
    { target: { value: "Thiếu bản xác nhận" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Gửi bàn giao" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/handoffs",
      expect.objectContaining({
        receiptChecklist: [
          {
            documentId: "doc1",
            expectedDocumentUpdatedAt: version,
            present: false,
          },
        ],
        shortcomings: "Thiếu bản xác nhận",
      }),
    ),
  );
});

it("explicitly adopts a published typed field schema with current Case version", async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) =>
    args[0] === "/cases/governance/field-definitions"
      ? {
          data: {
            data: [
              {
                id: "fields2",
                code: "default",
                status: "PUBLISHED",
                revision: 2,
                definition: {
                  fields: [
                    {
                      key: "custom_basis",
                      label: "Căn cứ bổ sung mới",
                      type: "text",
                      required: true,
                    },
                  ],
                },
              },
            ],
          },
        }
      : args[0].endsWith("/field-schema")
        ? { data: { data: null } }
        : get(...args),
  );
  mount();
  fireEvent.click(
    await screen.findByRole("tab", { name: "Phiên bản thông tin" }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Phiên bản trường đã công bố")
        .querySelector("option[value=fields2]"),
    ).not.toBeNull(),
  );
  fireEvent.change(screen.getByLabelText("Phiên bản trường đã công bố"), {
    target: { value: "fields2" },
  });
  fireEvent.change(screen.getByLabelText("Căn cứ bổ sung mới"), {
    target: { value: "Đã kiểm chứng" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Áp dụng phiên bản thông tin đã chọn" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/governance/field-schema",
      expect.objectContaining({
        fieldDefinitionVersionId: "fields2",
        values: { custom_basis: "Đã kiểm chứng" },
        expectedUpdatedAt: version,
      }),
    ),
  );
});
