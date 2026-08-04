import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { hasShownInput, inMainForm } from "../shownFieldKeys";
import { DynamicLegacyFields } from "@/components/DynamicLegacyFields";
import { LegacyParityFields } from "@/components/LegacyParityFields";

/**
 * Dedup UI: mỗi field hệ cũ hiện/sửa 1 chỗ. KHÔNG sót (long-tail vẫn hiện).
 * hasShownInput = key đã có ô (cột/form chính) → ẩn khỏi metadata panel.
 * inMainForm = form chính đã render → ẩn khỏi LegacyParityFields.
 */
describe("shownFieldKeys — phân loại đúng", () => {
  it("field đã có cột/form → hasShownInput=true (ẩn khỏi metadata panel)", () => {
    expect(hasShownInput("case", "nhanXet")).toBe(true);
    expect(hasShownInput("case", "nguon_don")).toBe(true);
    expect(hasShownInput("petition", "nhan_xet")).toBe(true);
    expect(hasShownInput("incident", "loai_thong_tin")).toBe(true);
  });
  it("long-tail thủ tục chưa có cột → hasShownInput=false (GIỮ, không sót)", () => {
    expect(hasShownInput("case", "ngayThongKe")).toBe(false);
    expect(hasShownInput("case", "ngay_thong_ke")).toBe(false);
  });
  it("Case: field intake render ở form chính → inMainForm=true (ẩn khỏi parity)", () => {
    expect(inMainForm("case", "nguonDon")).toBe(true);
    expect(inMainForm("case", "nhanXet")).toBe(true);
  });
  it("Case: cột parity KHÔNG ở form chính → inMainForm=false (GIỮ ở parity, không sót)", () => {
    expect(inMainForm("case", "ngayDeXuat")).toBe(false);
    expect(inMainForm("case", "ngayPhieuChuyen")).toBe(false);
  });
  it("Incident: cột parity không ở form chính → inMainForm=false (parity là ô duy nhất)", () => {
    expect(inMainForm("incident", "nhanXet")).toBe(false);
    expect(inMainForm("incident", "loaiThongTin")).toBe(false);
  });
});

describe("DynamicLegacyFields — chỉ hiện long-tail (dedup, không sót)", () => {
  it("ẩn key đã có cột, GIỮ long-tail", () => {
    render(
      <DynamicLegacyFields
        entity="case"
        values={{ nhanXet: "trùng cột", ngayThongKe: "2020-01-01", nguonDon: "trùng cột" }}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("dynamic-legacy-toggle"));
    // long-tail giữ
    expect(screen.getByTestId("legacy-field-ngayThongKe")).toBeInTheDocument();
    // trùng cột → ẩn
    expect(screen.queryByTestId("legacy-field-nhanXet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-field-nguonDon")).not.toBeInTheDocument();
  });
  it("metadata toàn key-đã-có-cột → panel ẩn (return null)", () => {
    const { container } = render(
      <DynamicLegacyFields entity="petition" values={{ nhan_xet: "x", nguon_don: "y" }} onChange={() => {}} />,
    );
    expect(container.querySelector('[data-testid="dynamic-legacy-toggle"]')).toBeNull();
  });
});

describe("LegacyParityFields — Case ẩn cột form-chính, Incident giữ", () => {
  it("Case: ẩn nguonDon (form chính), giữ ngayDeXuat (không ở form chính)", () => {
    render(<LegacyParityFields entity="case" values={{ ngayDeXuat: "2020-01-01", nguonDon: "x" }} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("parity-fields-toggle"));
    expect(screen.getByTestId("parity-field-ngayDeXuat")).toBeInTheDocument();
    expect(screen.queryByTestId("parity-field-nguonDon")).not.toBeInTheDocument();
  });
  it("Incident: giữ cột parity (form chính không có)", () => {
    render(<LegacyParityFields entity="incident" values={{ nhanXet: "x" }} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("parity-fields-toggle"));
    expect(screen.getByTestId("parity-field-nhanXet")).toBeInTheDocument();
  });
});
