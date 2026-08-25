import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LegacyParityFields } from "../LegacyParityFields";
import { LEGACY_PARITY_FIELDS } from "@/shared/legacy/legacyParityFields.generated";
import { LEGACY_FORM_OWNED_COLUMNS } from "@/features/cases/legacy-form-layout.def";

/**
 * Panel "Thông tin nghiệp vụ bổ sung" cuối trang KHÔNG được dựng ô thứ hai cho cột mà tab
 * đã có ô.
 *
 * Đây không phải chuyện thẩm mỹ. Giá trị của panel được gộp vào payload SAU giá trị của
 * form, nên hai ô cùng ghi một cột thì panel thắng — cán bộ gõ trong tab, bấm Lưu, và giá
 * trị bị thay bằng thứ panel đang giữ. Mất dữ liệu ngay trong một lần lưu.
 */
describe("LegacyParityFields không dựng ô trùng với tab", () => {
  it("với Vụ án: không cột nào của panel trùng cột form đã có ô", () => {
    render(<LegacyParityFields entity="case" values={{}} onChange={vi.fn()} />);
    // Panel gập sẵn — không mở ra thì không ô nào tồn tại và ca kiểm xanh vì lý do sai.
    fireEvent.click(screen.getByRole("button"));

    const trung = (LEGACY_PARITY_FIELDS.case ?? [])
      .map((d) => d.col)
      .filter((col) => LEGACY_FORM_OWNED_COLUMNS.has(col))
      .filter((col) => screen.queryByTestId(`parity-field-${col}`) !== null);

    expect(trung).toEqual([]);
  });

  it("Đơn thư và Vụ việc giữ nguyên — form của chúng chưa có các ô này", () => {
    const { container } = render(<LegacyParityFields entity="petition" values={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    // Không khẳng định số lượng cụ thể (danh sách sinh tự động), chỉ chốt là KHÔNG bị dọn sạch.
    expect(container.textContent).toContain("di trú hệ cũ");
  });
});
