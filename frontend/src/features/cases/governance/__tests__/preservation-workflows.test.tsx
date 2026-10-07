import { fireEvent, render, screen, waitFor } from "./render-governance";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { PreservationPanel } from "../PreservationPanel";
import { AccessPanel } from "../AccessPanel";
import { emptyWorkspace, type WorkspaceData } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const asset = {
  id: "asset1",
  caseId: "c1",
  documentId: "doc1",
  sha256: "a".repeat(64),
  createdAt: version,
};
const policy = {
  id: "policy1",
  revision: 3,
  status: "PUBLISHED",
  updatedAt: version,
  preserveUntil: "2027-10-01T02:00:00Z",
  basis: "Approved preservation basis",
  authorId: "maker",
};
const base: WorkspaceData = {
  ...emptyWorkspace,
  capabilities: {
    enabled: true,
    dispose: true,
    review: true,
    publish: true,
    share: true,
    canEdit: true,
    actorId: "reviewer",
  },
  snapshot: { caseId: "c1", updatedAt: version, handoffs: [], events: [] },
  evidence: {
    assets: [asset],
    retentionPolicies: [policy],
    dispositions: [],
    holds: [],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.get).mockResolvedValue({
    data: { data: [{ id: "doc1", title: "Actual receipt" }] },
  });
});
function mount(value = base) {
  render(
    <PreservationPanel caseId="c1" data={value} refresh={async () => {}} />,
  );
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("releases a hold by its immutable creation version with a recorded reason", async () => {
  mount({
    ...base,
    evidence: {
      ...base.evidence,
      holds: [
        {
          id: "hold1",
          createdAt: version,
          reason: "Preserve evidence",
          basis: "Actual order",
        },
      ],
    },
  });
  change("Lý do giải tỏa hold1", "Order superseded");
  fireEvent.click(
    screen.getByRole("button", { name: "Giải tỏa bảo toàn hold1" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/holds/hold1/release",
      expect.objectContaining({
        expectedAggregateUpdatedAt: version,
        reason: "Order superseded",
      }),
    ),
  );
});
it.each([
  ["DRAFT", "Thẩm định lưu giữ", "review", true],
  ["DRAFT", "Từ chối lưu giữ", "review", false],
  ["REVIEWED", "Công bố chính sách lưu giữ", "publish", undefined],
] as const)(
  "transitions retention %s with its exact reviewed revision",
  async (status, button, operation, approve) => {
    mount({
      ...base,
      evidence: {
        ...base.evidence,
        retentionPolicies: [{ ...policy, status }],
      },
    });
    change("Chính sách lưu giữ cần xử lý", "policy1");
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/evidence-governance/retention/policy1/${operation}`,
        expect.objectContaining({
          expectedRevision: 3,
          expectedAggregateUpdatedAt: version,
          ...(operation === "review" && { approve }),
        }),
      ),
    );
  },
);
it("revises a retention draft while preserving exact version transport", async () => {
  mount({
    ...base,
    evidence: {
      ...base.evidence,
      retentionPolicies: [{ ...policy, status: "DRAFT" }],
    },
  });
  change("Chính sách lưu giữ cần xử lý", "policy1");
  change("Căn cứ thời hạn lưu giữ", "Revised authoritative basis");
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa chính sách và hủy thẩm định cũ" }),
  );
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/retention/policy1",
      expect.objectContaining({
        basis: "Revised authoritative basis",
        expectedRevision: 3,
      }),
    ),
  );
});
it.each([false, true])(
  "reports retention eligibility %s without automatically disposing files",
  async (eligible) => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: {
          eligible,
          reason: eligible
            ? "ELIGIBLE_REQUIRES_APPROVED_DISPOSITION"
            : "ACTIVE_HOLD",
          preserve: true,
        },
      },
    });
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Kiểm tra điều kiện xử lý" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      eligible
        ? "Đủ điều kiện để lập yêu cầu có thẩm định"
        : "Tiếp tục bảo quản",
    );
    expect(api.post).not.toHaveBeenCalled();
  },
);
it("creates a disposition draft from selected owned versions and a published policy", async () => {
  mount();
  change("Chính sách đã công bố cho xử lý", "policy1");
  change("Mục đích xử lý", "Archive with retained original");
  fireEvent.click(screen.getByLabelText(/doc1 · aaaa/));
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo xử lý" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/dispositions",
      expect.objectContaining({
        policyId: "policy1",
        purpose: "Archive with retained original",
        assetVersionIds: ["asset1"],
      }),
    ),
  );
});
it.each([
  ["DRAFT", "Gửi thẩm định xử lý", "submit", undefined],
  ["SUBMITTED", "Phê duyệt xử lý", "review", true],
  ["SUBMITTED", "Từ chối xử lý", "review", false],
] as const)(
  "transitions disposition %s using the same parent and aggregate CAS",
  async (status, button, operation, approve) => {
    mount({
      ...base,
      evidence: {
        ...base.evidence,
        dispositions: [
          {
            id: "dispose1",
            policyId: "policy1",
            purpose: "Archived after review",
            revision: 2,
            updatedAt: version,
            status,
            authorId: "maker",
            assetVersionIds: ["asset1"],
          },
        ],
      },
    });
    change("Yêu cầu xử lý cần xem", "dispose1");
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/evidence-governance/dispositions/dispose1/${operation}`,
        expect.objectContaining({
          expectedRevision: 2,
          expectedUpdatedAt: version,
          expectedAggregateUpdatedAt: version,
          ...(operation === "review" && { approve }),
        }),
      ),
    );
  },
);
it("records an actual reviewed disposition outcome and receipt while preserving original bytes", async () => {
  mount({
    ...base,
    evidence: {
      ...base.evidence,
      dispositions: [
        {
          id: "dispose1",
          policyId: "policy1",
          purpose: "Archived after review",
          revision: 2,
          updatedAt: version,
          status: "APPROVED",
          authorId: "maker",
          assetVersionIds: ["asset1"],
        },
      ],
    },
  });
  change("Yêu cầu xử lý cần xem", "dispose1");
  expect(
    screen.getByRole("button", { name: "Ghi nhận kết quả và biên nhận" }),
  ).toBeDisabled();
  change("Kết quả xử lý thực tế", "ARCHIVED");
  change("Số biên nhận xử lý", "Receipt-01");
  change("Thời điểm biên nhận xử lý", "2026-10-05T09:00");
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Tài liệu biên nhận xử lý")
        .querySelector("option[value=doc1]"),
    ).not.toBeNull(),
  );
  change("Tài liệu biên nhận xử lý", "doc1");
  fireEvent.click(
    screen.getByRole("button", { name: "Ghi nhận kết quả và biên nhận" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/dispositions/dispose1/execute",
      expect.objectContaining({
        outcome: "ARCHIVED",
        receipt: {
          reference: "Receipt-01",
          recordedAt: expect.stringContaining("2026-10-05"),
          documentId: "doc1",
        },
      }),
    ),
  );
});
it("revises a rejected disposition with a concrete selected source part", async () => {
  mount({
    ...base,
    evidence: {
      ...base.evidence,
      dispositions: [
        {
          id: "dispose1",
          policyId: "policy1",
          purpose: "Original purpose",
          revision: 2,
          updatedAt: version,
          status: "REJECTED",
          assetVersionIds: ["asset1"],
        },
      ],
    },
  });
  change("Yêu cầu xử lý cần xem", "dispose1");
  change("Mục đích xử lý", "Revised reviewed purpose");
  fireEvent.click(screen.getByRole("button", { name: "Sửa yêu cầu xử lý" }));
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/dispositions/dispose1",
      expect.objectContaining({
        expectedRevision: 2,
        assetVersionIds: ["asset1"],
        purpose: "Revised reviewed purpose",
      }),
    ),
  );
});
it("revokes a representation grant at the exact grant revision", async () => {
  render(
    <AccessPanel
      caseId="c1"
      data={{
        ...base,
        evidence: {
          representationGrants: [
            {
              id: "grant1",
              revision: 2,
              updatedAt: version,
              lawyerId: "lawyer1",
              granteeId: "recipient1",
              startsAt: version,
              expiresAt: "2027-10-01T00:00:00Z",
              capabilities: ["view", "download"],
            },
          ],
        },
      }}
      refresh={async () => {}}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Thu hồi quyền đại diện grant1" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/representations/grant1/revoke",
      expect.objectContaining({
        expectedRevision: 2,
        expectedUpdatedAt: version,
      }),
    ),
  );
});
