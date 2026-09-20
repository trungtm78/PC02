/**
 * Nhóm I — TDD RED: PetitionAssignmentSection
 * Tests for multi-officer assignment section in PetitionFormPage edit mode.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as renderRaw, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { PetitionAssignmentSection } from "../PetitionAssignmentSection";

// Ô chọn cán bộ nay là `FKSelect` (tìm được + gom nhóm theo Tổ), mà `FKSelect` dùng
// `useQuery`. Ứng dụng thật đã có `QueryClientProvider` ở gốc (`App.tsx`); ca kiểm phải dựng
// lại đúng điều kiện ấy, không thì hỏng ở chỗ không liên quan gì tới thứ đang kiểm.
Element.prototype.scrollIntoView = vi.fn();
function render(node: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderRaw(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

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

const mockUsers = [
  { id: "user-1", firstName: "Nguyễn", lastName: "Văn A", username: "nguyenvana" },
  { id: "user-2", firstName: "Trần", lastName: "Thị B", username: "tranthib" },
  { id: "user-3", firstName: "Lê", lastName: "Văn C", username: "levanc" },
];

/**
 * Ô chọn cán bộ nhận hình của `useOfficerOptions` (nguồn cán bộ duy nhất): nhãn đã dựng sẵn,
 * kèm tổ. Hồ sơ phân công (`mockUsers`) vẫn là hình máy chủ trả — hai thứ khác nhau.
 */
const mockOfficerOptions = mockUsers.map((u) => ({
  value: u.id,
  label: `${u.lastName} ${u.firstName}`,
  teams: [],
}));

const mockAssignments = [
  {
    id: "pa-1",
    petitionId: "petition-001",
    userId: "user-1",
    user: mockUsers[0],
    role: "LEAD",
    assignedById: "user-admin",
    assignedBy: { id: "user-admin", username: "admin", firstName: "Admin", lastName: "" },
    assignedAt: "2026-06-08T00:00:00.000Z",
  },
  {
    id: "pa-2",
    petitionId: "petition-001",
    userId: "user-2",
    user: mockUsers[1],
    role: "SUPPORT",
    assignedById: "user-admin",
    assignedBy: { id: "user-admin", username: "admin", firstName: "Admin", lastName: "" },
    assignedAt: "2026-06-08T01:00:00.000Z",
  },
];


/** Chọn cán bộ qua ô combobox: mở ô rồi bấm đúng mục — đúng thao tác của cán bộ thật. */
function chonCanBo(id: string) {
  fireEvent.click(screen.getByTestId("assignment-user-select-trigger"));
  fireEvent.click(screen.getByTestId(`assignment-user-select-option-${id}`));
}

/** Các giá trị đang mời chọn trong ô. */
function idDangMoiChon(): string[] {
  fireEvent.click(screen.getByTestId("assignment-user-select-trigger"));
  return screen
    .getAllByRole("option")
    .map((o) => o.getAttribute("data-testid")?.replace("assignment-user-select-option-", "") ?? "");
}

describe("PetitionAssignmentSection", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  // ── I-F1: Initial load ────────────────────────────────────────────────────

  it("I-F1: renders section header và loads assignments on mount", async () => {
    apiGet.mockResolvedValue({ data: mockAssignments });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    expect(screen.getByTestId("section-phan-cong")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/petitions/petition-001/assignments");
    });
  });

  it("I-F2: hiển thị danh sách phân công sau khi load", async () => {
    apiGet.mockResolvedValue({ data: mockAssignments });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => {
      expect(screen.getByTestId("assignment-list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("assignment-role-user-1")).toHaveTextContent("Chủ trì");
    expect(screen.getByTestId("assignment-role-user-2")).toHaveTextContent("Hỗ trợ");
  });

  it("I-F3: hiển thị 'Chưa có cán bộ' khi danh sách rỗng", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => {
      expect(screen.getByText(/Chưa có cán bộ/)).toBeInTheDocument();
    });
  });

  // ── I-F4: Add assignment ─────────────────────────────────────────────────

  it("I-F4: nút Thêm bị disable khi chưa chọn user", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => expect(screen.getByTestId("btn-add-assignment")).toBeInTheDocument());
    expect(screen.getByTestId("btn-add-assignment")).toBeDisabled();
  });

  it("I-F5: thêm phân công thành công → cập nhật danh sách", async () => {
    apiGet.mockResolvedValue({ data: [] });
    const newAssignment = {
      id: "pa-3",
      petitionId: "petition-001",
      userId: "user-3",
      user: mockUsers[2],
      role: "SUPPORT",
      assignedById: "admin",
      assignedBy: { id: "admin", username: "admin", firstName: "Admin", lastName: "" },
      assignedAt: "2026-06-08T02:00:00.000Z",
    };
    apiPost.mockResolvedValue({ data: newAssignment });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => expect(screen.getByTestId("btn-add-assignment")).toBeInTheDocument());

    chonCanBo("user-3");
    fireEvent.click(screen.getByTestId("btn-add-assignment"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/petitions/petition-001/assignments",
        expect.objectContaining({ userId: "user-3" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("assignment-role-user-3")).toBeInTheDocument();
    });
  });

  it("I-F6: chọn vai trò LEAD trước khi thêm", async () => {
    apiGet.mockResolvedValue({ data: [] });
    const newAssignment = {
      id: "pa-4",
      petitionId: "petition-001",
      userId: "user-1",
      user: mockUsers[0],
      role: "LEAD",
      assignedById: "admin",
      assignedBy: { id: "admin", username: "admin" },
      assignedAt: "2026-06-08T02:00:00.000Z",
    };
    apiPost.mockResolvedValue({ data: newAssignment });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => expect(screen.getByTestId("assignment-user-select")).toBeInTheDocument());

    chonCanBo("user-1");
    fireEvent.change(screen.getByTestId("assignment-role-select"), { target: { value: "LEAD" } });
    fireEvent.click(screen.getByTestId("btn-add-assignment"));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/petitions/petition-001/assignments",
        expect.objectContaining({ userId: "user-1", role: "LEAD" }),
      );
    });
  });

  // ── I-F7: Remove assignment ──────────────────────────────────────────────

  it("I-F7: xóa phân công thành công → xóa khỏi danh sách", async () => {
    apiGet.mockResolvedValue({ data: mockAssignments });
    apiDelete.mockResolvedValue({ data: { success: true } });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-remove-assignment-user-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-remove-assignment-user-1"));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/petitions/petition-001/assignments/user-1");
    });
    await waitFor(() => {
      expect(screen.queryByTestId("assignment-role-user-1")).not.toBeInTheDocument();
    });
  });

  // ── I-F8: Already-assigned users filtered from dropdown ─────────────────

  it("I-F8: user đã phân công không xuất hiện trong dropdown thêm", async () => {
    apiGet.mockResolvedValue({ data: mockAssignments });
    render(<PetitionAssignmentSection petitionId="petition-001" userOptions={mockOfficerOptions} />);
    await waitFor(() => expect(screen.getByTestId("assignment-list")).toBeInTheDocument());

    const options = idDangMoiChon();
    expect(options).not.toContain("user-1");
    expect(options).not.toContain("user-2");
    expect(options).toContain("user-3");
  });
});
