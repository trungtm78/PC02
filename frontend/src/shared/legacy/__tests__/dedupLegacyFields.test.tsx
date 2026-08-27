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

describe("LegacyParityFields — panel im khi bố cục hệ cũ đã có ô", () => {
  /**
   * MỐC ĐÚNG ĐÃ ĐỔI 26/08/2026, KHÔNG PHẢI CA KIỂM BỊ SỬA CHO KHỚP MÃ.
   *
   * Bản cũ chốt "ngayDeXuat vẫn hiện ở panel vì form chính không có ô". Từ epic dựng form
   * Vụ án theo bố cục hệ cũ, tab Thông tin ĐÃ CÓ ô "Ngày/Tháng/Năm đề xuất" ở đúng vị trí
   * hệ cũ — nên panel phải im, không dựng ô thứ hai.
   *
   * Không đổi mốc này thì mỗi cột có hai ô cùng ghi một chỗ, và vì panel gộp vào payload
   * SAU form nên nó đè giá trị cán bộ vừa gõ trong tab.
   */
  it("Case: ẩn CẢ nguonDon lẫn ngayDeXuat — tab đã có ô cho hai cột này", () => {
    render(<LegacyParityFields entity="case" values={{ ngayDeXuat: "2020-01-01", nguonDon: "x" }} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("parity-fields-toggle"));
    expect(screen.queryByTestId("parity-field-nguonDon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("parity-field-ngayDeXuat")).not.toBeInTheDocument();
  });
  /**
   * MỐC ĐÚNG LẠI ĐỔI 27/08/2026, CŨNG KHÔNG PHẢI CA KIỂM BỊ SỬA CHO KHỚP MÃ.
   *
   * Bản cũ chốt "Vụ việc giữ cột parity vì form chính không có ô". Từ epic dựng form Vụ việc
   * theo bố cục hệ cũ, tab Thông tin ĐÃ CÓ ô "Nhận xét" ở đúng vị trí hệ cũ — nên panel phải
   * im, đúng như Vụ án và Đơn thư.
   *
   * Giữ mốc cũ nghĩa là mỗi cột có hai ô cùng ghi một chỗ, và vì panel gộp vào payload SAU
   * form nên nó đè giá trị cán bộ vừa gõ trong tab.
   */
  it("Incident: ẩn nhanXet — tab đã có ô cho cột này", () => {
    render(<LegacyParityFields entity="incident" values={{ nhanXet: "x" }} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId("parity-fields-toggle"));
    expect(screen.queryByTestId("parity-field-nhanXet")).not.toBeInTheDocument();
  });

  /**
   * Panel vẫn phải giữ ô cho cột mà bố cục hệ cũ KHÔNG có — nếu không thì dữ liệu di trú ở
   * những cột ấy không còn chỗ sửa nào.
   */
  it("Incident: vẫn giữ cột mà bố cục hệ cũ không có ô", () => {
    render(
      <LegacyParityFields entity="incident" values={{ phanLoaiHoSoNoiBo: "x" }} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("parity-fields-toggle"));
    expect(screen.getByTestId("parity-field-phanLoaiHoSoNoiBo")).toBeInTheDocument();
  });
});
