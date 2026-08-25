import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { LegacyLayoutSection } from "../LegacyLayoutSection";
import type { LegacyLayoutItem } from "@/features/cases/legacy-form-layout.def";
import { INITIAL_FORM_DATA, type CaseFormData } from "../types";

vi.mock("@/components/CrimeSelect", () => ({
  CrimeSelect: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));

function Host({ items }: { items: readonly LegacyLayoutItem[] }) {
  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <div>
      <LegacyLayoutSection items={items} formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors} />
      <output data-testid="peek">{JSON.stringify({ nguonDon: formData.nguonDon, ngayThongKe: formData.statistic.ngayThongKe, laCongNgheCao: formData.laCongNgheCao, lyDo: formData.lyDoKhongKhoiTo })}</output>
    </div>
  );
}

const peek = () => JSON.parse(screen.getByTestId("peek").textContent ?? "{}");

describe("LegacyLayoutSection", () => {
  it("dựng ô theo đúng thứ tự đặc tả, nhãn nguyên văn", () => {
    render(
      <Host
        items={[
          { caption: "Nguồn đơn/Đơn vị giao", field: "nguonDon", kind: "text", span: "half" },
          { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full" },
        ]}
      />,
    );
    const nhan = screen.getAllByText(/Nguồn đơn|Tóm tắt/).map((n) => n.textContent?.trim());
    expect(nhan).toEqual(["Nguồn đơn/Đơn vị giao", "Tóm tắt nội dung"]);
  });

  it("ô tràn dòng chiếm cả hai cột, ô nửa dòng thì không", () => {
    render(
      <Host
        items={[
          { caption: "Nửa dòng", field: "nguonDon", kind: "text", span: "half" },
          { caption: "Tràn dòng", field: "nhanXet", kind: "textarea", span: "full" },
        ]}
      />,
    );
    expect(screen.getByTestId("legacy-field-nguonDon").className).not.toContain("md:col-span-2");
    expect(screen.getByTestId("legacy-field-nhanXet").className).toContain("md:col-span-2");
  });

  it("gõ vào ô thường thì ghi thẳng vào formData", () => {
    render(<Host items={[{ caption: "Nguồn đơn/Đơn vị giao", field: "nguonDon", kind: "text", span: "half" }]} />);
    fireEvent.change(screen.getByLabelText(/Nguồn đơn/), { target: { value: "Bưu điện" } });
    expect(peek().nguonDon).toBe("Bưu điện");
  });

  it("ô thuộc bảng thống kê ghi vào nhánh statistic, không đè lên gốc", () => {
    render(<Host items={[{ caption: "Ngày tổng hợp thống kê", field: "statistic.ngayThongKe", kind: "date", span: "half" }]} />);
    fireEvent.change(screen.getByLabelText(/Ngày tổng hợp thống kê/), { target: { value: "2026-08-26" } });
    expect(peek().ngayThongKe).toBe("2026-08-26");
  });

  it("ô bật/tắt lưu giá trị đúng-sai chứ không lưu chuỗi", () => {
    render(<Host items={[{ caption: "Bấm chọn nếu xác định đây là tội phạm công nghệ cao", field: "laCongNgheCao", kind: "toggle", span: "full" }]} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(peek().laCongNgheCao).toBe(true);
  });

  it("ô chọn nhiều lưu mảng mã, bỏ chọn thì rút khỏi mảng", () => {
    const item: LegacyLayoutItem = {
      caption: "Lý do ra Quyết định không khởi tố vụ án",
      field: "lyDoKhongKhoiTo",
      kind: "multiselect",
      span: "full",
      options: [
        { value: "a", label: "Không có sự việc phạm tội;" },
        { value: "b", label: "Hành vi không cấu thành tội phạm;" },
      ],
    };
    render(<Host items={[item]} />);
    fireEvent.click(screen.getByLabelText("Không có sự việc phạm tội;"));
    fireEvent.click(screen.getByLabelText("Hành vi không cấu thành tội phạm;"));
    expect(peek().lyDo).toEqual(["a", "b"]);
    fireEvent.click(screen.getByLabelText("Không có sự việc phạm tội;"));
    expect(peek().lyDo).toEqual(["b"]);
  });

  it("trường gương gắn hậu tố (Tab: X) như hệ cũ", () => {
    render(<Host items={[{ caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", mirrorOf: "info" }]} />);
    expect(screen.getByText("Tóm tắt nội dung (Tab: Thông tin)")).toBeInTheDocument();
  });

  /**
   * Đây là hành vi khiến hệ cũ dễ dùng: một ô hiện ở nhiều tab, gõ chỗ nào cũng như nhau.
   * Ca kiểm dựng hai mục cùng trỏ `description` để chốt rằng không cần cơ chế đồng bộ riêng.
   */
  it("hai mục cùng trỏ một ô lưu thì gõ ở đâu cũng đồng bộ", () => {
    render(
      <Host
        items={[
          { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full" },
          { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", mirrorOf: "info" },
        ]}
      />,
    );
    const goc = screen.getByLabelText("Tóm tắt nội dung");
    fireEvent.change(goc, { target: { value: "Nội dung thử" } });
    expect((screen.getByLabelText("Tóm tắt nội dung (Tab: Thông tin)") as HTMLTextAreaElement).value).toBe("Nội dung thử");
  });

  it("ô bắt buộc hiện dấu sao", () => {
    render(<Host items={[{ caption: "Số điện thoại nguyên đơn", field: "sdtCungCap", kind: "text", span: "half", required: true }]} />);
    const nhan = screen.getByText(/Số điện thoại nguyên đơn/);
    expect(within(nhan).getByText("*")).toBeInTheDocument();
  });

  it("lỗi của ô hiện ngay dưới ô đó", () => {
    function HostLoi() {
      const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
      const [errors, setErrors] = useState<Record<string, string>>({ sdtCungCap: "Chưa nhập số điện thoại" });
      return (
        <LegacyLayoutSection
          items={[{ caption: "Số điện thoại nguyên đơn", field: "sdtCungCap", kind: "text", span: "half", required: true }]}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />
      );
    }
    render(<HostLoi />);
    expect(screen.getByText("Chưa nhập số điện thoại")).toBeInTheDocument();
  });
});
