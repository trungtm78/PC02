import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { LegacyTabBody } from "../LegacyTabBody";
import { INITIAL_FORM_DATA, type CaseFormData } from "../types";
import {
  LEGACY_FORM_LAYOUT,
  LEGACY_TAB_LABEL,
  legacyCaption,
  type LegacyTabId,
} from "@/features/cases/legacy-form-layout.def";

vi.mock("@/components/CrimeSelect", () => ({
  CrimeSelect: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/components/FKSelect", () => ({
  FKSelect: ({ label }: { label: string }) => <div>{label}</div>,
}));

/**
 * Bọc `QueryClientProvider`: từ 27/08/2026 ô chọn-nhiều có khai danh mục (`source`) dựng bằng
 * `CatalogSelect` thay vì một nhóm ô tích RỖNG — nhóm rỗng nghĩa là cán bộ nhìn thấy ô mà
 * không nhập được gì. `CatalogSelect` tra danh mục nên cần bộ truy vấn.
 */
function Host({ tabId, extra, initial = INITIAL_FORM_DATA }: { tabId: LegacyTabId; extra?: React.ReactNode; initial?: CaseFormData }) {
  const [formData, setFormData] = useState<CaseFormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return (
    <QueryClientProvider client={qc}>
      <LegacyTabBody tabId={tabId} formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors}>
        {extra}
      </LegacyTabBody>
    </QueryClientProvider>
  );
}

const TAB_IDS = Object.keys(LEGACY_FORM_LAYOUT) as LegacyTabId[];

describe("LegacyTabBody", () => {
  it('shows the original partial date beside the blank native input until the date is corrected', () => {
    render(<Host tabId="info" initial={{ ...INITIAL_FORM_DATA, ngayVietDon: '198X' }} />);
    expect(screen.getByTestId('legacy-date-source-ngayVietDon')).toHaveTextContent('198X');
    const input = screen.getByTestId('legacy-field-ngayVietDon').querySelector('input');
    expect(input).toHaveValue('');
    fireEvent.change(input!, { target: { value: '1981-10-05' } });
    expect(screen.queryByTestId('legacy-date-source-ngayVietDon')).toBeNull();
  });
  it('keeps the nullable checkbox mixed in the shared layout until an explicit officer choice', () => {
    render(<Host tabId="media" initial={{ ...INITIAL_FORM_DATA, statistic: { ...INITIAL_FORM_DATA.statistic, ghiAmGhiHinhDaDuocXetXu: null } }} />);
    const field = screen.getByTestId('legacy-field-statistic.ghiAmGhiHinhDaDuocXetXu');
    expect(within(field).getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(within(field).getByRole('button', { name: 'Không' }));
    expect(within(field).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(within(field).getByRole('button', { name: 'Chưa xác minh' }));
    expect(within(field).getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });
  describe.each(TAB_IDS)("tab %s", (tabId) => {
    it("dựng đủ ô hệ cũ, đúng thứ tự, nhãn nguyên văn", () => {
      render(<Host tabId={tabId} />);
      const khung = screen.getByTestId(`legacy-layout-${tabId}`);
      // Mỗi ô được bọc trong một khối mang data-testid riêng, nên đọc theo thứ tự khối là
      // đọc đúng thứ tự trên màn hình — không phụ thuộc ô ấy dựng bằng thẻ gì.
      const oTrenManHinh = Array.from(khung.querySelectorAll("[data-testid^='legacy-field-']")).map(
        (n) => (n.textContent ?? "").replace(/\s+/g, " ").trim(),
      );
      const items = LEGACY_FORM_LAYOUT[tabId];

      expect(oTrenManHinh.length).toBe(items.length);
      items.forEach((item, i) => {
        expect(
          oTrenManHinh[i].startsWith(legacyCaption(item)),
          `tab ${LEGACY_TAB_LABEL[tabId]} — ô thứ ${i + 1} phải là "${legacyCaption(item)}" nhưng đang là "${oTrenManHinh[i]}"`,
        ).toBe(true);
      });
    });
  });

  it("khối Bổ sung hệ mới GẬP SẴN — cán bộ hệ cũ nhập xong phần trên là xong", () => {
    render(<Host tabId="info" extra={<p>Ô riêng của hệ mới</p>} />);
    const khoi = screen.getByTestId("bo-sung-he-moi-info") as HTMLDetailsElement;
    expect(khoi.open).toBe(false);
    expect(within(khoi).getByText("Ô riêng của hệ mới")).toBeInTheDocument();
  });

  it("không có gì bổ sung thì không dựng khối gập rỗng", () => {
    render(<Host tabId="evidence" />);
    expect(screen.queryByTestId("bo-sung-he-moi-evidence")).toBeNull();
  });

  it("khối ghim luôn hiện, không nằm trong khối gập", () => {
    function HostGhim() {
      const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
      const [errors, setErrors] = useState<Record<string, string>>({});
      return (
        <LegacyTabBody
          tabId="info"
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
          pinnedTop={<p data-testid="ghim">Nguồn vụ án</p>}
        >
          <p>phần gập</p>
        </LegacyTabBody>
      );
    }
    render(<HostGhim />);
    const ghim = screen.getByTestId("ghim");
    expect(ghim).toBeInTheDocument();
    expect(screen.getByTestId("bo-sung-he-moi-info").contains(ghim)).toBe(false);
  });
});
