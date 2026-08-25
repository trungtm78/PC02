import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DTBSTable } from "../DTBSTable";
import { DTBS_TABLE_COLUMNS } from "@/features/cases/legacy-form-layout.def";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function renderBang(caseId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DTBSTable caseId={caseId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.get.mockResolvedValue({ data: { data: [] } });
  mockApi.post.mockResolvedValue({ data: {} });
  mockApi.delete.mockResolvedValue({ data: {} });
});

describe("Bảng Danh sách điều tra bổ sung", () => {
  it("dựng đúng năm cột dữ liệu + cột Thao tác của hệ cũ, đúng thứ tự", async () => {
    renderBang("case-1");
    await waitFor(() => expect(screen.getByTestId("dtbs-table")).toBeInTheDocument());

    const cot = screen.getAllByRole("columnheader").map((t) => t.textContent?.trim());
    expect(cot).toEqual([...DTBS_TABLE_COLUMNS]);
  });

  /**
   * Bản ghi điều tra bổ sung gắn với một vụ án đã tồn tại. Ở chế độ Tạo mới chưa có mã hồ
   * sơ để gắn, nên phải nói rõ thay vì hiện một bảng rỗng bấm gì cũng không được.
   */
  it("chế độ Tạo mới: nói rõ phải lưu hồ sơ trước, không hiện bảng bấm không được", () => {
    renderBang(undefined);
    expect(screen.getByTestId("dtbs-chua-luu")).toBeInTheDocument();
    expect(screen.queryByTestId("dtbs-table")).not.toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("hiện bản ghi đã có, ngày trống thì gạch ngang", async () => {
    mockApi.get.mockResolvedValue({
      data: {
        data: [
          {
            id: "s1",
            type: "Điều tra bổ sung",
            decisionNumber: "12/QD-DTBS",
            reason: "VKS trả hồ sơ",
            ngayTiepNhanDTBS: "2026-08-01T00:00:00.000Z",
            ngayTraHoSoVKS: "2026-08-05T00:00:00.000Z",
            ngayTraHoSoToaAn: null,
          },
        ],
      },
    });
    renderBang("case-1");

    const hang = await screen.findByTestId("dtbs-hang-0");
    const o = within(hang).getAllByRole("cell").map((c) => c.textContent?.trim());
    expect(o[0]).toBe("1");
    expect(o[1]).toBe("01/08/2026");
    expect(o[2]).toBe("12/QD-DTBS");
    expect(o[3]).toBe("05/08/2026");
    expect(o[4]).toBe("—");
  });

  /**
   * Ô ngày để trống phải BỎ HẲN khỏi lời gọi. Máy chủ dùng `@IsOptional()`, mà `@IsOptional()`
   * coi chuỗi rỗng là CÓ giá trị nên vẫn chạy tiếp `@IsDateString()` và trả 400.
   */
  it("thêm bản ghi: ô ngày để trống bị bỏ hẳn, không gửi chuỗi rỗng", async () => {
    renderBang("case-1");
    await waitFor(() => expect(screen.getByTestId("dtbs-table")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("dtbs-them"));
    fireEvent.change(screen.getByLabelText("Số Quyết định điều tra bổ sung"), {
      target: { value: "77/QD-DTBS" },
    });
    fireEvent.change(screen.getByLabelText("Ngày tiếp nhận án điều tra bổ sung"), {
      target: { value: "2026-08-11" },
    });
    fireEvent.click(screen.getByTestId("dtbs-xac-nhan"));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalled());
    const body = mockApi.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.caseId).toBe("case-1");
    expect(body.decisionNumber).toBe("77/QD-DTBS");
    expect(body.ngayTiepNhanDTBS).toBe("2026-08-11");
    expect(body).not.toHaveProperty("ngayTraHoSoVKS");
    expect(body).not.toHaveProperty("ngayTraHoSoToaAn");
    expect(body).not.toHaveProperty("decisionDate");
  });

  it("chưa nhập Số Quyết định thì không cho xác nhận", async () => {
    renderBang("case-1");
    await waitFor(() => expect(screen.getByTestId("dtbs-table")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("dtbs-them"));
    expect(screen.getByTestId("dtbs-xac-nhan")).toBeDisabled();
  });

  it("xóa bản ghi gọi đúng địa chỉ", async () => {
    mockApi.get.mockResolvedValue({
      data: { data: [{ id: "s9", type: "x", decisionNumber: "9", reason: "r" }] },
    });
    renderBang("case-1");
    fireEvent.click(await screen.findByTestId("dtbs-xoa-0"));
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith("/investigation-supplements/s9"));
  });
});
