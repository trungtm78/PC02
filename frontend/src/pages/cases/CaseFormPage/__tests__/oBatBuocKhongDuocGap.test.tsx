import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabInfo } from "../tabs";
import { INITIAL_FORM_DATA, type CaseFormData } from "../types";

vi.mock("@/components/CrimeSelect", () => ({
  CrimeSelect: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), delete: vi.fn() },
}));

/**
 * Ô BẮT BUỘC không được nằm trong khối gập.
 *
 * Khối "Bổ sung hệ mới" đóng sẵn để tab Thông tin giữ đúng bộ ô của hệ cũ. Nhưng ô "Tiêu đề
 * hồ sơ" là ô máy chủ BẮT BUỘC, và nó đi theo vào khối gập ấy. Hệ quả bấm được ngay trên máy
 * thật 26/08/2026: cán bộ điền hết tab, bấm Lưu, nhận thông báo "Vui lòng nhập tiêu đề hồ sơ"
 * — mà trên màn hình không có ô nào tên như vậy.
 *
 * Cùng lý do đã ghim `Nguồn vụ án` lên trên: hễ máy chủ bắt buộc thì ô phải nhìn thấy được.
 */

function Host() {
  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TabInfo
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Ô bắt buộc trên tab Thông tin", () => {
  it('ô "Tiêu đề hồ sơ" không nằm trong khối gập', () => {
    render(<Host />);
    const o = screen.getByTestId("input-case-title");
    expect(o.closest("details")).toBeNull();
  });

  it('chỉ có MỘT ô "Tiêu đề hồ sơ" — gỡ bản trùng trong khối Bổ sung hệ mới', () => {
    render(<Host />);
    expect(screen.getAllByTestId("input-case-title")).toHaveLength(1);
  });
});
