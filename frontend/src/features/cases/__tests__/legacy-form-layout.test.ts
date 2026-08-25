import { describe, it, expect } from "vitest";
import {
  LEGACY_FORM_LAYOUT,
  LEGACY_TAB_LABEL,
  legacyCaption,
  type LegacyTabId,
} from "../legacy-form-layout.def";
import { OLD_SYSTEM_CAPTIONS } from "./fixtures/old-system-captions";

/**
 * Ca kiểm này là lời hứa với cán bộ đang dùng hệ cũ: mở hệ mới ra thì thấy đúng những ô
 * ấy, đúng chữ ấy, đúng thứ tự ấy.
 *
 * Mốc đúng KHÔNG lấy từ đặc tả mà từ `fixtures/old-system-captions.ts` — bản kết xuất DOM
 * chụp thẳng từ `pc02hcm.com/doi-1/Them`. So đặc tả với chính nó thì ca kiểm chỉ chứng minh
 * đặc tả bằng đặc tả, một lỗi gõ sẽ được hợp thức hoá thay vì bị bắt.
 */

/** Ba lỗi đánh máy của hệ cũ, anh đồng ý sửa 26/08/2026. Ngoài ba chỗ này, phải khớp tuyệt đối. */
const SUA_LOI_DANH_MAY: readonly (readonly [string, string])[] = [
  ["nễu", "nếu"],
  ["vụ khí nóng", "vũ khí nóng"],
  ["toàn án", "toà án"],
];

function apDungSuaLoi(caption: string): string {
  return SUA_LOI_DANH_MAY.reduce((s, [sai, dung]) => s.replaceAll(sai, dung), caption);
}

const TAB_IDS = Object.keys(LEGACY_FORM_LAYOUT) as LegacyTabId[];

describe("Bố cục form Vụ án theo hệ cũ", () => {
  it("khai đủ 10 tab, đúng khoá và đúng thứ tự hệ cũ", () => {
    expect(TAB_IDS).toEqual([
      "info",
      "incident",
      "case",
      "subjects",
      "incident-tdc",
      "case-tdc",
      "evidence",
      "business-files",
      "statistics",
      "media",
    ]);
  });

  it("nhãn tab đúng chữ hệ cũ", () => {
    expect(Object.values(LEGACY_TAB_LABEL)).toEqual([
      "Thông tin",
      "Vụ việc",
      "Vụ án",
      "ĐTBS",
      "Vụ việc TĐC",
      "Vụ án TĐC",
      "Vật chứng",
      "HS nghiệp vụ",
      "TK 48 trường",
      "Ghi âm, ghi hình",
    ]);
  });

  describe.each(TAB_IDS)("tab %s", (tabId) => {
    const items = LEGACY_FORM_LAYOUT[tabId];
    const nhanChup = OLD_SYSTEM_CAPTIONS[tabId];

    it("có đúng số ô như hệ cũ", () => {
      expect(items.length).toBe(nhanChup.length);
    });

    it("nhãn và thứ tự khớp bản chụp hệ cũ, chỉ khác ở ba lỗi đánh máy đã sửa", () => {
      // Bản chụp giữ cả hậu tố "(Tab: X)" của trường gương và dấu sao ô bắt buộc; dựng lại
      // đúng chuỗi ấy từ đặc tả rồi mới so, để ca kiểm chốt cả ba thứ cùng lúc:
      // chữ nhãn, chỗ nào là gương, và ô nào bắt buộc.
      const tuDacTa = items.map((it) => {
        const sao = it.required ? " *" : "";
        return it.mirrorOf
          ? `${it.caption}${sao} (Tab: ${LEGACY_TAB_LABEL[it.mirrorOf]})`
          : `${it.caption}${sao}`;
      });
      const mocDung = nhanChup.map(apDungSuaLoi);
      expect(tuDacTa).toEqual(mocDung);
    });

    it("mọi ô đều khai chỗ đứng nửa dòng hay tràn dòng", () => {
      for (const it of items) {
        expect(["half", "full"]).toContain(it.span);
      }
    });

    it("ô chọn phải có nguồn lựa chọn, không để rỗng", () => {
      for (const it of items) {
        if (it.kind === "select") expect(it.options?.length ?? 0).toBeGreaterThan(0);
        if (it.kind === "fk") expect(it.source).toBeTruthy();
      }
    });
  });

  it("trường gương trỏ về tab có thật và không tự trỏ chính mình", () => {
    for (const tabId of TAB_IDS) {
      for (const it of LEGACY_FORM_LAYOUT[tabId]) {
        if (!it.mirrorOf) continue;
        expect(TAB_IDS).toContain(it.mirrorOf);
        expect(it.mirrorOf).not.toBe(tabId);
      }
    }
  });

  it("trường gương dùng CHUNG ô lưu với bản gốc — sửa một chỗ là mọi tab đổi theo", () => {
    for (const tabId of TAB_IDS) {
      for (const it of LEGACY_FORM_LAYOUT[tabId]) {
        if (!it.mirrorOf) continue;
        const goc = LEGACY_FORM_LAYOUT[it.mirrorOf].find((g) => g.field === it.field);
        expect(
          goc,
          `"${it.caption}" ở tab ${tabId} khai gương của ${it.mirrorOf} nhưng tab gốc không có ô nào lưu vào "${it.field}"`,
        ).toBeTruthy();
      }
    }
  });

  it("legacyCaption gắn hậu tố (Tab: X) đúng như hệ cũ", () => {
    expect(
      legacyCaption({ caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", mirrorOf: "info" }),
    ).toBe("Tóm tắt nội dung (Tab: Thông tin)");
    expect(
      legacyCaption({ caption: "Nguồn đơn/Đơn vị giao", field: "nguonDon", kind: "text", span: "half" }),
    ).toBe("Nguồn đơn/Đơn vị giao");
  });

  it("không ô nào của hệ cũ bị bỏ quên: tổng số ô đúng bằng bản chụp", () => {
    const tongDacTa = TAB_IDS.reduce((n, t) => n + LEGACY_FORM_LAYOUT[t].length, 0);
    const tongChup = TAB_IDS.reduce((n, t) => n + OLD_SYSTEM_CAPTIONS[t].length, 0);
    expect(tongDacTa).toBe(tongChup);
  });
});
