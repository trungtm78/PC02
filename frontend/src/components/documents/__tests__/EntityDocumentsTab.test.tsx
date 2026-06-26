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

// Danh mục động DOCUMENT_TYPE: mock useCatalog (tránh gọi API /catalog/ qua api mock generic).
vi.mock("@/hooks/useCatalog", () => ({
  useCatalog: () => ({
    options: [
      { code: "VAN_BAN", label: "Văn bản" },
      { code: "HINH_ANH", label: "Hình ảnh" },
      { code: "VIDEO", label: "Video" },
      { code: "AM_THANH", label: "Âm thanh" },
      { code: "KHAC", label: "Khác" },
    ],
    isLoading: false,
  }),
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

  // v0.67.6 — upload button ẩn khi entityId là undefined để tránh confuse create mode
  it("hides 'Tải lên tài liệu' button when entityId is undefined", () => {
    render(<EntityDocumentsTab entityKind="petition" entityId={undefined} />, { wrapper });
    expect(screen.queryByRole("button", { name: /Tải lên tài liệu/i })).toBeNull();
  });

  it("shows 'Tải lên tài liệu' button when entityId is provided", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    expect(screen.getByRole("button", { name: /Tải lên tài liệu/i })).toBeTruthy();
  });

  // v0.67.6 — Enter key trong title/description input không bubble lên outer form
  // Bug: EntityDocumentsTab nhúng trong <form onSubmit> của PetitionFormPage/IncidentFormPage,
  // nhấn Enter trong input → outer form submit → redirect. Fix: onKeyDown preventDefault.
  it("prevents Enter key from bubbling out of title input (no outer form submit)", async () => {
    const outerSubmit = vi.fn((e: Event) => e.preventDefault());
    const { container } = render(
      <form onSubmit={outerSubmit as any}>
        <EntityDocumentsTab entityKind="petition" entityId="pet-1" />
      </form>,
      { wrapper },
    );

    const openBtn = screen.getByRole("button", { name: /Tải lên tài liệu/i });
    fireEvent.click(openBtn);

    const titleInput = await screen.findByPlaceholderText(/Biên bản khám nghiệm/i);
    fireEvent.keyDown(titleInput, { key: "Enter", code: "Enter", charCode: 13 });

    expect(outerSubmit).not.toHaveBeenCalled();
    // Đảm bảo form vẫn mở (không bị reset bởi submit)
    expect(container.querySelector('input[placeholder*="Biên bản"]')).toBeTruthy();
  });

  it("prevents Enter key from bubbling out of description input", async () => {
    const outerSubmit = vi.fn((e: Event) => e.preventDefault());
    render(
      <form onSubmit={outerSubmit as any}>
        <EntityDocumentsTab entityKind="incident" entityId="inc-1" />
      </form>,
      { wrapper },
    );

    const openBtn = screen.getByRole("button", { name: /Tải lên tài liệu/i });
    fireEvent.click(openBtn);

    const descInput = await screen.findByPlaceholderText(/Ghi chú về tài liệu/i);
    fireEvent.keyDown(descInput, { key: "Enter", code: "Enter", charCode: 13 });

    expect(outerSubmit).not.toHaveBeenCalled();
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

// ── G0: Multi-file + Folder upload ────────────────────────────────────────────
describe("EntityDocumentsTab — multi-file + folder upload (G0)", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
    apiGet.mockResolvedValue({ data: { data: [] } });
  });

  it("file input has multiple attribute for multi-select", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.multiple).toBe(true);
  });

  it("renders a 'Chọn thư mục' button to trigger folder upload", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));
    expect(screen.getByRole("button", { name: /Chọn thư mục/i })).toBeTruthy();
  });

  it("selecting 2 files shows their names in the queue", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(["a"], "bao_cao.pdf", { type: "application/pdf" });
    const file2 = new File(["b"], "chung_tu.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    Object.defineProperty(fileInput, "files", { value: [file1, file2], writable: true });
    fireEvent.change(fileInput);

    await waitFor(() => expect(screen.queryByText("bao_cao.pdf")).toBeTruthy());
    expect(screen.queryByText("chung_tu.docx")).toBeTruthy();
  });

  it("uploading 2 files calls POST /documents twice with petitionId", async () => {
    apiPost.mockResolvedValue({ data: {} });
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-99" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));

    const titleInput = await screen.findByPlaceholderText(/Biên bản khám nghiệm/i);
    fireEvent.change(titleInput, { target: { value: "Hồ sơ" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(["a"], "file1.pdf", { type: "application/pdf" });
    const file2 = new File(["b"], "file2.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [file1, file2], writable: true });
    fireEvent.change(fileInput);

    const allBtns = screen.getAllByRole("button");
    const submit = allBtns.find((b) => /^Tải lên$/i.test(b.textContent?.trim() ?? ""));
    expect(submit).toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    const [, fd0] = apiPost.mock.calls[0];
    const [, fd1] = apiPost.mock.calls[1];
    expect((fd0 as FormData).get("petitionId")).toBe("pet-99");
    expect((fd1 as FormData).get("petitionId")).toBe("pet-99");
  });

  it("upload continues for remaining files when one fails (partial success)", async () => {
    apiPost
      .mockRejectedValueOnce(new Error("file too large"))
      .mockResolvedValue({ data: {} });

    render(<EntityDocumentsTab entityKind="petition" entityId="pet-99" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));

    const titleInput = await screen.findByPlaceholderText(/Biên bản khám nghiệm/i);
    fireEvent.change(titleInput, { target: { value: "Hồ sơ" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(["a"], "big.pdf", { type: "application/pdf" });
    const file2 = new File(["b"], "small.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [file1, file2], writable: true });
    fireEvent.change(fileInput);

    const allBtns = screen.getAllByRole("button");
    const submit = allBtns.find((b) => /^Tải lên$/i.test(b.textContent?.trim() ?? ""));
    fireEvent.click(submit!);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    // Both files attempted even though first one failed
    expect(apiPost).toHaveBeenCalledTimes(2);
  });

  it("closing and reopening form resets queue (cancel clears queued files)", async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="pet-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));

    // Add files to queue
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(["a"], "queued.pdf", { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { value: [file1], writable: true });
    fireEvent.change(fileInput);

    await waitFor(() => expect(screen.queryByText("queued.pdf")).toBeTruthy());

    // Cancel — close form
    const cancelBtn = screen.getByRole("button", { name: /Hủy/i });
    fireEvent.click(cancelBtn);

    // Reopen form
    fireEvent.click(screen.getByRole("button", { name: /Tải lên tài liệu/i }));

    // Queue should be empty
    expect(screen.queryByText("queued.pdf")).toBeNull();
  });
});
