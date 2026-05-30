import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EntityDocumentsTab } from "../EntityDocumentsTab";

// Mock api client — tránh real HTTP, capture query+body.
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: any[]) => apiGet(...args),
    post: (...args: any[]) => apiPost(...args),
    delete: (...args: any[]) => apiDelete(...args),
  },
}));

vi.mock("@/lib/api-errors", () => ({
  extractApiError: (e: any, fallback: string) => ({ message: e?.message ?? fallback }),
}));

vi.mock("@/lib/dates", () => ({
  formatVNDate: (s: string) => `vn-${s}`,
}));

// Mock FKSelect — tránh kéo theo dependency tree (react-query/useDirectoryOptions).
vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({ value, onChange }: any) => (
    <select data-testid="fk-doc-type" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="VAN_BAN">Văn bản</option>
      <option value="HINH_ANH">Hình ảnh</option>
    </select>
  ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("EntityDocumentsTab", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
    apiGet.mockResolvedValue({ data: { data: [] } });
  });

  it("fetches documents by caseId when entityKind='case'", async () => {
    render(<EntityDocumentsTab entityKind="case" entityId="case-1" />, { wrapper });
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("caseId=case-1"));
    });
  });

  it("fetches documents by petitionId when entityKind='petition'", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("petitionId=pet-1"));
    });
  });

  it("fetches documents by incidentId when entityKind='incident'", async () => {
    render(<EntityDocumentsTab entityKind="incident" entityId="inc-1" />, { wrapper });
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("incidentId=inc-1"));
    });
  });

  it("shows guard message when entityId is undefined (petition kind)", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId={undefined} />, { wrapper });
    expect(screen.queryByText(/Lưu đơn/i)).toBeTruthy();
  });

  it("shows guard message tailored per entity kind (case)", async () => {
    render(<EntityDocumentsTab entityKind="case" entityId={undefined} />, { wrapper });
    expect(screen.queryByText(/Lưu hồ sơ/i)).toBeTruthy();
  });

  it("upload POSTs FormData with petitionId key when entityKind='petition'", async () => {
    apiPost.mockResolvedValue({ data: {} });
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });

    // Mở form — click button by accessible name (chỉ button đầu có chữ "Tải lên tài liệu")
    const openBtn = screen.getByRole("button", { name: /Tải lên tài liệu/i });
    fireEvent.click(openBtn);

    // Fill title — wait form render xong
    const titleInput = await screen.findByPlaceholderText(/Biên bản khám nghiệm/i);
    fireEvent.change(titleInput, { target: { value: "Đơn tố cáo bản gốc" } });

    // Add file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["abc"], "test.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    // Submit — button submit có chữ "Tải lên" không kèm "tài liệu"
    const submitBtns = screen.getAllByRole("button");
    const submit = submitBtns.find((b) => /^Tải lên$/i.test(b.textContent?.trim() ?? "")) ?? submitBtns[submitBtns.length - 1];
    fireEvent.click(submit);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalled();
    });
    const [url, formData] = apiPost.mock.calls[0];
    expect(url).toBe("/documents");
    expect((formData as FormData).get("petitionId")).toBe("pet-1");
    expect((formData as FormData).get("caseId")).toBeNull();
  });
});
