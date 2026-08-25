import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

function Host({ tabId, extra }: { tabId: LegacyTabId; extra?: React.ReactNode }) {
  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <LegacyTabBody tabId={tabId} formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors}>
      {extra}
    </LegacyTabBody>
  );
}

const TAB_IDS = Object.keys(LEGACY_FORM_LAYOUT) as LegacyTabId[];

describe("LegacyTabBody", () => {
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
