import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { SuspensionModal } from "../SuspensionModal";

// CatalogSelect (trong modal) gọi useQuery → cần QueryClient (như app thật ở root).
function renderWithQC(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SuspensionModal — lý do TĐC vụ án qua CatalogSelect (PR-3)", () => {
  it("render select lý do với option danh mục cat-{code} (Đ.229)", () => {
    renderWithQC(
      <SuspensionModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} isLegacyCase={false} />,
    );
    // CatalogSelect single render <select> với testid giữ nguyên.
    expect(screen.getByTestId("select-ly-do")).toBeInTheDocument();
    expect(screen.getByTestId("cat-CHUA_XAC_DINH_BI_CAN")).toBeInTheDocument();
    expect(screen.getByTestId("cat-BAT_KHA_KHANG")).toBeInTheDocument();
  });

  it("không render khi isOpen=false", () => {
    renderWithQC(
      <SuspensionModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} isLegacyCase={false} />,
    );
    expect(screen.queryByTestId("select-ly-do")).not.toBeInTheDocument();
  });
});
