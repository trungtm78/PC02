import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LegacyRawPanel } from "../LegacyRawPanel";

/**
 * Regression: field ngày hệ cũ lưu Unix timestamp (giây) phải hiện dd/mm/yyyy,
 * KHÔNG in số thô (bug: "Ngày đề xuất: 943869600"). Field tiền/số không bị nhầm thành ngày.
 */
describe("LegacyRawPanel — format ngày Unix timestamp", () => {
  const open = () => fireEvent.click(screen.getByTestId("legacy-raw-toggle"));

  it("ngay_de_xuat (Unix ts) → dd/mm/yyyy, không in số thô", () => {
    render(<LegacyRawPanel raw={{ ngay_de_xuat: 1575972000 }} />);
    open();
    expect(screen.getByText("11/12/2019")).toBeInTheDocument();
    expect(screen.queryByText("1575972000")).not.toBeInTheDocument();
  });

  it("timestamp dạng chuỗi số cũng format", () => {
    render(<LegacyRawPanel raw={{ ngay_phieu_chuyen: "1512381600" }} />);
    open();
    expect(screen.getByText("05/12/2017")).toBeInTheDocument();
  });

  it("field tiền (số lớn) KHÔNG bị nhầm thành ngày", () => {
    render(<LegacyRawPanel raw={{ so_tien_bi_thiet_hai: 5500000000 }} />);
    open();
    expect(screen.getByText("5500000000")).toBeInTheDocument();
  });

  it("số đếm nhỏ giữ nguyên", () => {
    render(<LegacyRawPanel raw={{ so_luong_bi_hai: 3 }} />);
    open();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("chuỗi ngày dd/mm/yyyy giữ nguyên (không phải timestamp)", () => {
    render(<LegacyRawPanel raw={{ ngay_viet_don: "15/03/2021" }} />);
    open();
    expect(screen.getByText("15/03/2021")).toBeInTheDocument();
  });
});
