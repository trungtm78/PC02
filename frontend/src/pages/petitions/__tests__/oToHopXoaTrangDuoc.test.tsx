import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authStore, type AuthUser } from "@/stores/auth.store";

/**
 * Ô tổ hợp "Ghi chú trùng đơn" phải xoá trắng được.
 *
 * Trước 20/09/2026 ca này canh HAI ô: ô tra tiền án của "Tội danh cũ trước đây" và ô tra đơn
 * trùng. Ô thứ nhất đã gỡ cùng ô "Tội danh cũ" theo yêu cầu của anh, nên mệnh đề ấy không còn
 * diễn được nữa — giữ lại là một ca kiểm chạy trên thứ không tồn tại. Việc "ba ô đã bỏ không
 * dựng ở tab nào" do `baOAnKhongDungNua.gate.test.tsx` canh.
 *
 * Ô còn lại dùng một ô nhập tạm (`dupQuery`) và lấy chuỗi RỖNG làm dấu hiệu
 * "cán bộ chưa gõ gì". Dấu hiệu ấy đụng đúng vào thao tác xoá:
 *
 *   value = suspectQuery !== "" ? suspectQuery : formData.toiDanhBanDau
 *
 * Cán bộ xoá hết chữ → ô nhập tạm thành rỗng → ô hiển thị TỰ ĐIỀN LẠI giá trị cũ ngay trước
 * mắt; và lúc rời ô, nhánh `if (query !== "")` không chạy nên không ghi gì. Kết quả: ô này
 * không thể xoá được, dù thân lời gọi đã gửi `null` đúng cách.
 *
 * Đây là cùng một lỗi "xoá trắng rồi Lưu giá trị cũ ở lại", chỉ nằm ở trạng thái giao diện
 * chứ không nằm ở thân lời gọi. Dấu hiệu đúng phải là `null` — thứ phân biệt được "chưa gõ"
 * với "đã gõ và xoá hết".
 */

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock("@/features/document-numbers/api", () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({
      previewNumber: "DT-2026-00001",
      isDraft: true,
      templateId: "tmpl-2",
    }),
  },
}));

vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({
    value,
    onChange,
    testId,
  }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select
      data-testid={testId}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">--</option>
    </select>
  ),
}));

vi.mock("@/components/CrimeSelect", () => ({
  CrimeSelect: ({
    value,
    onChange,
    testId,
  }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select
      data-testid={testId}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">--</option>
    </select>
  ),
}));

const HO_SO: AuthUser = {
  id: "u1",
  email: "a@b.com",
  username: "a",
  firstName: "A",
  lastName: "B",
  role: "OFFICER",
  canDispatch: false,
  teams: [{ teamId: "team-doi-1", teamName: "Đội 1", isLeader: true }],
  primaryTeam: { teamId: "team-doi-1", teamName: "Đội 1" },
};

async function dungForm() {
  const { PetitionFormPage } = await import("../PetitionFormPage");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/petitions/new"]}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authStore.setProfile(HO_SO);
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Ô tổ hợp trên form Đơn thư phải xoá trắng được", () => {
  it.each([["duplicate-search-input", "26-11184"]])(
    'ô "%s": gõ rồi xoá hết thì ô ở trạng thái rỗng, không tự điền lại',
    async (testid, chu) => {
      await dungForm();
      const o = (await screen.findByTestId(testid)) as HTMLInputElement;

      // Gõ rồi rời ô: ô nhập tạm được ghi vào formData sau 200ms. Phải chờ đúng mốc ấy, nếu
      // không thì bước xoá bên dưới chạy khi formData vẫn rỗng và ca kiểm xanh giả.
      fireEvent.change(o, { target: { value: chu } });
      fireEvent.blur(o);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
      expect(o.value).toBe(chu);

      // Xoá hết chữ: ô phải ở trạng thái rỗng ngay, không tự điền lại giá trị vừa ghi.
      fireEvent.change(o, { target: { value: "" } });
      expect(o.value).toBe("");

      fireEvent.blur(o);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 260));
      });
      expect(o.value).toBe("");
    },
  );
});
