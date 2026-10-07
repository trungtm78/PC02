import { fireEvent, render, screen, waitFor } from "./render-governance";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { DisclosurePanel } from "../DisclosurePanel";
import { emptyWorkspace, type WorkspaceData } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const packet = {
  id: "packet1",
  revision: 2,
  status: "APPROVED",
  updatedAt: version,
  purpose: "Exact-version disclosure",
  basis: "Reviewed authority",
  recipientId: "recipient1",
  expiresAt: "2027-10-01T00:00:00Z",
  authorId: "maker",
  approvedHash: "b".repeat(64),
  items: [{ assetVersionId: "asset1", sha256: "a".repeat(64) }],
};
const base: WorkspaceData = {
  ...emptyWorkspace,
  snapshot: { caseId: "c1", updatedAt: version, handoffs: [], events: [] },
  capabilities: {
    enabled: true,
    share: true,
    review: true,
    download: true,
    canEdit: true,
    actorId: "reviewer",
  },
  evidence: {
    assets: [
      {
        id: "asset1",
        documentId: "doc1",
        kind: "ORIGINAL",
        sha256: "a".repeat(64),
      },
    ],
    packets: [packet],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({
    data: { data: [{ id: "recipient1", firstName: "Authorized recipient" }] },
  });
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue("blob:packet"),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
function mount(row = packet) {
  render(
    <DisclosurePanel
      caseId="c1"
      data={{ ...base, evidence: { ...base.evidence, packets: [row] } }}
      refresh={async () => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Gói cung cấp cần xử lý"), {
    target: { value: "packet1" },
  });
}
it.each([
  ["DRAFT", "Gửi thẩm định gói", "submit", undefined],
  ["SUBMITTED", "Phê duyệt gói cung cấp", "review", true],
  ["SUBMITTED", "Từ chối gói cung cấp", "review", false],
] as const)(
  "transitions packet %s against exact current revision",
  async (status, title, operation, approve) => {
    mount({ ...packet, status });
    fireEvent.click(screen.getByRole("button", { name: title }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `/cases/c1/evidence-governance/packets/packet1/${operation}`,
        expect.objectContaining({
          expectedRevision: 2,
          expectedAggregateUpdatedAt: version,
          expectedUpdatedAt: version,
          ...(operation === "review" && { approve }),
        }),
      ),
    );
    expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty(
      "contentPolicy",
    );
  },
);
it("revises a packet through typed fields and keeps the exact item selection", async () => {
  mount({ ...packet, status: "DRAFT" });
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Người nhận gói cung cấp")
        .querySelector("option[value=recipient1]"),
    ).not.toBeNull(),
  );
  fireEvent.change(screen.getByLabelText("Mục đích cung cấp"), {
    target: { value: "Revised purpose requires review again" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa gói và hủy phê duyệt cũ" }),
  );
  await waitFor(() =>
    expect(api.patch).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/packets/packet1",
      expect.objectContaining({
        expectedRevision: 2,
        purpose: "Revised purpose requires review again",
        items: [{ assetVersionId: "asset1" }],
      }),
    ),
  );
});
it("exports the immutable approved manifest and downloads the exact-version bundle", async () => {
  vi.mocked(api.post).mockResolvedValueOnce({
    data: {
      data: {
        manifest: { packetId: "packet1" },
        manifestHash: packet.approvedHash,
        files: [],
      },
    },
  });
  mount();
  fireEvent.click(
    screen.getByRole("button", { name: "Tải gói cung cấp đã duyệt" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/packets/packet1/export",
      {},
    ),
  );
  expect(
    await screen.findByText(/Gói đã xuất kèm manifest/),
  ).toBeInTheDocument();
  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:packet");
});
it("revokes online access with a recorded reason and exact packet revision", async () => {
  mount();
  fireEvent.change(screen.getByLabelText("Lý do thu hồi gói"), {
    target: { value: "Recipient entitlement revoked" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Thu hồi quyền tải gói" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/packets/packet1/revoke",
      expect.objectContaining({
        reason: "Recipient entitlement revoked",
        expectedRevision: 2,
      }),
    ),
  );
  expect(
    screen.getByText(/Bản đã tải xuống không thể thu/),
  ).toBeInTheDocument();
});
it.each([{ expiresAt: "2020-01-01T00:00:00Z" }, { revokedAt: version }])(
  "blocks an expired or revoked approved packet in the UI",
  async (extra) => {
    mount({ ...packet, ...extra });
    expect(
      screen.getByRole("button", { name: "Tải gói cung cấp đã duyệt" }),
    ).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    await screen.findByRole("option", { name: "Authorized recipient" });
  },
);
it("blocks self-review and incomplete hidden-source packet approval", async () => {
  render(
    <DisclosurePanel
      caseId="c1"
      data={{
        ...base,
        evidence: {
          ...base.evidence,
          packets: [
            {
              ...packet,
              status: "SUBMITTED",
              authorId: "reviewer",
              contentsHidden: true,
            },
          ],
        },
      }}
      refresh={async () => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Gói cung cấp cần xử lý"), {
    target: { value: "packet1" },
  });
  expect(
    screen.getByRole("button", { name: "Phê duyệt gói cung cấp" }),
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Chưa thể phê duyệt");
  await screen.findByRole("option", { name: "Authorized recipient" });
});
it("downloads a standalone offline verifier that uses a separately trusted approval hash", async () => {
  mount();
  fireEvent.click(
    screen.getByRole("button", { name: "Tải công cụ kiểm chứng ngoại tuyến" }),
  );
  expect(URL.createObjectURL).toHaveBeenCalled();
  await screen.findByRole("option", { name: "Authorized recipient" });
});
