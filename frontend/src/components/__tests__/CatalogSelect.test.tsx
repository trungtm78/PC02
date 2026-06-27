import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { CatalogSelect } from "../CatalogSelect";

// useCatalog gọi useQuery (enabled:false cho legal) → vẫn cần QueryClient context như trong app thật.
const renderWithQuery = (ui: ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe("CatalogSelect (legal multi)", () => {
  it("render đủ 7 option legal", async () => {
    renderWithQuery(<CatalogSelect catalogKey="LY_DO_KHONG_KHOI_TO" value={[]} onChange={() => {}} multi />);
    expect(await screen.findByText("Hết thời hiệu truy cứu TNHS (khoản 1đ)")).toBeInTheDocument();
    expect(screen.getByText("Người phạm tội đã chết (khoản 1d)")).toBeInTheDocument();
  });

  it("tick checkbox gọi onChange với mảng code", () => {
    const onChange = vi.fn();
    renderWithQuery(<CatalogSelect catalogKey="LY_DO_KHONG_KHOI_TO" value={[]} onChange={onChange} multi />);
    fireEvent.click(screen.getByTestId("cat-HET_THOI_HIEU"));
    expect(onChange).toHaveBeenCalledWith(["HET_THOI_HIEU"]);
  });

  it("bỏ tick loại code khỏi mảng", () => {
    const onChange = vi.fn();
    renderWithQuery(
      <CatalogSelect
        catalogKey="LY_DO_KHONG_KHOI_TO"
        value={["HET_THOI_HIEU", "NGUOI_PHAM_TOI_CHET"]}
        onChange={onChange}
        multi
      />,
    );
    fireEvent.click(screen.getByTestId("cat-HET_THOI_HIEU"));
    expect(onChange).toHaveBeenCalledWith(["NGUOI_PHAM_TOI_CHET"]);
  });
});
