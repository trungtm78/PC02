import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "./render-governance";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { EvidencePanel } from "../EvidencePanel";
import { DisclosurePanel } from "../DisclosurePanel";
import { emptyWorkspace } from "../shared";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
const version = "2026-10-06T01:00:00.000Z";
const asset = {
  id: "asset1",
  documentId: "doc1",
  sha256: "a".repeat(64),
  kind: "ORIGINAL",
  createdAt: version,
};
const data = {
  ...emptyWorkspace,
  capabilities: {
    enabled: true,
    custody: true,
    share: true,
    review: true,
    dispose: true,
    publish: true,
    canEdit: true,
    actorId: "reviewer",
  },
  snapshot: { caseId: "c1", updatedAt: version, handoffs: [], events: [] },
  evidence: { assets: [asset], custody: [], packets: [] },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({
    data: {
      data: [{ id: "doc1", title: "Actual receipt", updatedAt: version }],
    },
  });
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
});
it("renders nested immutable custody facts and marks legacy unknown facts explicitly", async () => {
  render(
    <EvidencePanel
      caseId="c1"
      data={{
        ...data,
        evidence: {
          ...data.evidence,
          custody: [
            {
              id: "event2",
              eventType: "CORRECTION",
              occurredAt: version,
              correctsEventId: "event1",
              payload: {
                version: 2,
                previousEventId: "event1",
                facts: {
                  fromHolder: {
                    kind: "PERSON",
                    identifier: "person1",
                    name: "Actual sender",
                  },
                  toHolder: {
                    kind: "WAREHOUSE",
                    identifier: "warehouse1",
                    name: "Actual custodian",
                  },
                  fromLocation: "Original locker",
                  toLocation: "Verified locker",
                  condition: "SEALED",
                  conditionNote: "Seal verified",
                  receiptReference: "BB-actual",
                  receiptDocumentId: "receipt1",
                  correctionReason: "Corrected actual location",
                },
                sourceSnapshot: {
                  documentId: "receipt1",
                  documentUpdatedAt: version,
                  sha256: "b".repeat(64),
                },
              },
            },
            {
              id: "legacy",
              eventType: "RECEIPT",
              occurredAt: version,
              payload: { version: 1 },
            },
          ],
        },
      }}
      refresh={async () => {}}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  for (const value of [
    "Actual sender",
    "person1",
    "Actual custodian",
    "warehouse1",
    "Original locker",
    "Verified locker",
    "SEALED",
    "Seal verified",
    "BB-actual",
    "Corrected actual location",
    "b".repeat(64),
  ])
    expect(screen.getByText(new RegExp(value))).toBeInTheDocument();
  expect(screen.getAllByText(/receipt1/)).toHaveLength(2);
  expect(
    screen.getByText(
      "Chưa có dữ kiện giao nhận được xác minh cho sự kiện này.",
    ),
  ).toBeInTheDocument();
});
it("registers actual first physical receipt with null prior custodian and nested typed facts", async () => {
  render(<EvidencePanel caseId="c1" data={data} refresh={async () => {}} />);
  fireEvent.change(screen.getByLabelText("Phiên bản chứng cứ được giao nhận"), {
    target: { value: "asset1" },
  });
  for (const [label, value] of Object.entries({
    "Loại sự kiện giao nhận": "RECEIPT",
    "Thời điểm giao nhận thực tế": "2026-10-05T09:00",
    "Bên nhận · loại": "WAREHOUSE",
    "Bên nhận · mã định danh": "warehouse1",
    "Bên nhận · tên": "Kho chứng cứ",
    "Nơi nhận": "Ngăn lưu trữ 1",
    "Tình trạng niêm phong và vật chứng": "SEALED",
    "Mô tả tình trạng giao nhận": "Niêm phong còn nguyên",
    "Số biên bản giao nhận": "BB-01",
  }))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await waitFor(() =>
    expect(
      screen
        .getByLabelText("Biên bản giao nhận đã tải lên")
        .querySelector("option[value=doc1]"),
    ).not.toBeNull(),
  );
  fireEvent.change(screen.getByLabelText("Biên bản giao nhận đã tải lên"), {
    target: { value: "doc1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Ghi thêm sự kiện giao nhận" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/c1/evidence-governance/custody",
      expect.objectContaining({
        expectedCustodyEventId: null,
        eventType: "RECEIPT",
        custodyFacts: {
          fromHolder: null,
          fromLocation: null,
          toHolder: {
            kind: "WAREHOUSE",
            identifier: "warehouse1",
            name: "Kho chứng cứ",
          },
          toLocation: "Ngăn lưu trữ 1",
          condition: "SEALED",
          conditionNote: "Niêm phong còn nguyên",
          receiptDocumentId: "doc1",
          receiptReference: "BB-01",
        },
      }),
    ),
  );
});
it("pins public-content policy per exact packet item rather than sending unsupported review flags", async () => {
  render(<DisclosurePanel caseId="c1" data={data} refresh={async () => {}} />);
  fireEvent.click(screen.getByLabelText("Chọn phiên bản asset1"));
  fireEvent.change(
    screen.getByLabelText("Chính sách nội dung phiên bản asset1"),
    { target: { value: "PUBLIC_CONTENT_REVIEWED" } },
  );
  expect(
    screen.getByLabelText("Chính sách nội dung phiên bản asset1"),
  ).toHaveValue("PUBLIC_CONTENT_REVIEWED");
  await act(async () => {
    await Promise.resolve();
  });
});
