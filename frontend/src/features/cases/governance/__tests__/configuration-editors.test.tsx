import { fireEvent, render, screen, waitFor } from "./render-governance";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import CaseConfigurationPage from "../CaseConfigurationPage";
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url.endsWith("/capabilities")
        ? {
            enabled: true,
            operate: true,
            review: true,
            publish: true,
            actorId: "maker",
            caseAccessMode: "INTERNAL",
          }
        : url.endsWith("/catalog")
          ? {
              actions: [
                { code: "RESTORE_SUSPENDED", label: "Phục hồi điều tra" },
              ],
              additionalActions: ["VERIFY_PHASE"],
              fieldPolicyCatalog: [
                {
                  key: "name",
                  column: "name",
                  aliases: ["caseTitle"],
                  group: "BASIC_INFORMATION",
                },
                {
                  key: "description",
                  column: "moTaChiTiet",
                  aliases: [],
                  group: "LEGACY_132",
                  label: "Tóm tắt nội dung",
                },
              ],
            }
          : [],
    },
  }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
});
function mount() {
  render(
    <MemoryRouter>
      <CaseConfigurationPage />
    </MemoryRouter>,
  );
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

it("builds a reviewed civil-period rule through legal sources, safe conditions, anchors, durations and calendar controls", async () => {
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Thêm thao tác quy tắc" }),
  );
  change("Thao tác quy tắc 1", "RESTORE_SUSPENDED");
  change("Có hiệu lực từ", "2026-01-01");
  change("Hết hiệu lực vào", "2027-01-01");
  for (const [label, value] of Object.entries({
    "Mã tham chiếu nguồn 1.1": "law1",
    "Văn bản nguồn 1.1": "Synthetic reviewed instrument",
    "Điều khoản 1.1": "Article 1",
    "URL nguồn 1.1": "https://example.test/law",
    "Thẩm quyền nguồn 1.1": "CQDT",
    "Nguồn có hiệu lực từ 1.1": "2026-01-01",
    "Nguồn hết hiệu lực 1.1": "2027-01-01",
  }))
    change(label, value);
  fireEvent.click(screen.getByLabelText("Ủy thác điều tra"));
  change(
    "Trường bắt buộc (mỗi dòng một đường dẫn) 1",
    "payload.decision.number\npayload.deadlineFacts.restoration",
  );
  fireEvent.click(screen.getByRole("button", { name: "Thêm điều kiện 1" }));
  change("Điều kiện 1 · kiểu điều kiện", "all");
  change("Điều kiện 1.1 · đường dẫn an toàn", "case.status");
  change("Điều kiện 1.1 · phép so sánh", "eq");
  change("Điều kiện 1.1 · giá trị", "TAM_DINH_CHI");
  fireEvent.click(
    screen.getByRole("button", { name: "Thêm điều kiện con Điều kiện 1" }),
  );
  change("Điều kiện 1.2 · đường dẫn an toàn", "payload.deadlineFacts.gravity");
  change("Điều kiện 1.2 · phép so sánh", "in");
  change("Điều kiện 1.2 · kiểu giá trị", "list");
  change("Điều kiện 1.2 · giá trị", "IT_NGHIEM_TRONG\nNGHIEM_TRONG");
  change("Thời hạn 1 · cách xử lý", "CALCULATE");
  change("Thời hạn 1 · giai đoạn", "RESTORED");
  change("Thời hạn 1 · Mốc phục hồi", "payload.deadlineFacts.restoration");
  change("Thời hạn 1 · Mốc khởi tố", "case.ngayKhoiTo");
  change("Thời hạn 1 · Mốc nhận hồ sơ", "payload.deadlineFacts.dossierReceipt");
  change(
    "Thời hạn 1 · Mốc nhận yêu cầu",
    "payload.deadlineFacts.requestReceipt",
  );
  change(
    "Thời hạn 1 · đường dẫn thẩm quyền",
    "payload.deadlineFacts.authority",
  );
  change(
    "Thời hạn 1 · đường dẫn mức nghiêm trọng",
    "payload.deadlineFacts.gravity",
  );
  change("Thời hạn 1 · mã nguồn căn cứ", "law1");
  fireEvent.click(
    screen.getByRole("button", { name: "Thêm kỳ thời hạn Thời hạn 1" }),
  );
  change("Thời hạn 1 · mức nghiêm trọng 1", "NGHIEM_TRONG");
  change("Thời hạn 1 · thẩm quyền 1", "VKS");
  change("Thời hạn 1 · số kỳ 1", "2");
  change("Thời hạn 1 · đơn vị kỳ 1", "MONTHS");
  for (const [label, value] of Object.entries({
    "Thời hạn 1 · Mã lịch": "reviewed-calendar",
    "Thời hạn 1 · Phiên bản lịch": "2",
    "Thời hạn 1 · Lịch có hiệu lực từ": "2026-01-01",
    "Thời hạn 1 · Lịch có hiệu lực đến": "2027-01-01",
    "Thời hạn 1 · Ngày nghỉ (mỗi dòng một giá trị)": "2026-10-10",
    "Thời hạn 1 · Ngày làm việc bù (mỗi dòng một giá trị)": "2026-10-11",
    "Thời hạn 1 · Mã nguồn lịch (mỗi dòng một giá trị)": "law1",
  }))
    change(label, value);
  fireEvent.click(screen.getByLabelText("Thứ hai nghỉ"));
  fireEvent.click(screen.getByLabelText("Thứ hai nghỉ"));
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo cấu hình" }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  const body = vi.mocked(api.post).mock.calls[0][1];
  expect(body).toHaveProperty(
    "definition.actions.0.deadlineEffect.phase",
    "RESTORED",
  );
  expect(body).toHaveProperty(
    "definition.actions.0.deadlineEffect.durations.0",
    { gravity: "NGHIEM_TRONG", value: 2, unit: "MONTHS", authority: "VKS" },
  );
  expect(body).toHaveProperty("definition.actions.0.conditions.all.1", {
    path: "payload.deadlineFacts.gravity",
    op: "in",
    value: ["IT_NGHIEM_TRONG", "NGHIEM_TRONG"],
  });
  expect(body).toHaveProperty("definition.actions.0.allowedCaseTypes", [
    "REGULAR",
    "UY_THAC_DIEU_TRA",
  ]);
  expect(body).toHaveProperty(
    "definition.actions.0.deadlineEffect.calendar.sourceReferenceIds",
    ["law1"],
  );
});
it.each(["text", "textarea", "number", "boolean", "date", "select"])(
  "creates typed field %s with sensitivity and tab policy",
  async (type) => {
    mount();
    fireEvent.click(
      await screen.findByRole("tab", { name: "Trường thông tin" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm trường bổ sung" }),
    );
    change("Khóa trường 1", "custom_value");
    change("Nhãn trường 1", "Verified field");
    change("Kiểu dữ liệu 1", type);
    change("Mức hạn chế 1", "RESTRICTED");
    change("Tab hiển thị 1", "case");
    fireEvent.click(screen.getByLabelText("Bắt buộc nhập trường 1"));
    if (type === "select")
      change("Lựa chọn 1 (mỗi dòng một giá trị)", "Choice one\nChoice two");
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu dự thảo cấu hình" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/cases/governance/field-definitions",
        expect.objectContaining({
          definition: expect.objectContaining({
            fields: [
              expect.objectContaining({
                key: "custom_value",
                label: "Verified field",
                type,
                required: true,
                sensitivity: "RESTRICTED",
                tab: "case",
              }),
            ],
          }),
        }),
      ),
    );
  },
);
it("uses separate basic and legacy policy groups and omits server-owned runtime flags in publication drafts", async () => {
  mount();
  fireEvent.click(await screen.findByRole("tab", { name: "Trường thông tin" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Thêm chính sách trường gốc" }),
  );
  change("Trường gốc áp dụng 1", "name");
  change("Mức hạn chế trường gốc 1", "RESTRICTED");
  fireEvent.click(screen.getByLabelText("Cho phép tìm kiếm 1"));
  fireEvent.click(screen.getByLabelText("Cho phép xuất 1"));
  expect(
    screen.getByLabelText("Trường gốc áp dụng 1").querySelectorAll("optgroup"),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Lưu dự thảo cấu hình" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/cases/governance/field-definitions",
      expect.objectContaining({
        definition: {
          fields: [],
          fieldPolicies: [
            {
              key: "name",
              sensitivity: "RESTRICTED",
              searchable: false,
              exportable: false,
            },
          ],
        },
      }),
    ),
  );
});
