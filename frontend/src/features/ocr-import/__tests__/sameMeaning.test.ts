import { describe, expect, it } from "vitest";
import { sameMeaning } from "../sameMeaning";

describe("sameMeaning", () => {
  it("ignores spacing, case and Unicode form, which a re-read would otherwise report as differences", () => {
    expect(sameMeaning("Hồ Chí Minh", "HỒ CHÍ MINH")).toBe(true);
    expect(sameMeaning("phường  Chánh Hiệp", " phường Chánh Hiệp ")).toBe(true);
    // Decomposed (NFD) and composed (NFC) forms of the same text.
    expect(sameMeaning("Hồ".normalize("NFD"), "Hồ".normalize("NFC"))).toBe(
      true,
    );
  });

  it("compares a phone or ID number written with separators by its digits", () => {
    expect(sameMeaning("0902422652", "0902 422 652", "sdtCungCap")).toBe(true);
    expect(sameMeaning("0902.422.652", "0902-422-652", "sdtCungCap")).toBe(true);
    expect(sameMeaning("074054001179", "074 054 001 179", "cccdCungCap")).toBe(true);
  });

  it("does not strip punctuation from other identifiers, where it can be the difference", () => {
    // A transfer-slip number 12-34 is not 1234.
    expect(sameMeaning("12-34", "1234", "soPhieuChuyen")).toBe(false);
    expect(sameMeaning("0902 422 652", "0902422652")).toBe(false);
  });

  it("still reports real differences", () => {
    expect(sameMeaning("0902422652", "0902422653", "sdtCungCap")).toBe(false);
    expect(sameMeaning("Nguyễn Văn A", "Nguyễn Văn B")).toBe(false);
    expect(sameMeaning("1954", "1945")).toBe(false);
    expect(sameMeaning("", "0902422652")).toBe(false);
  });

  it("does not treat words that merely contain digits as numbers", () => {
    expect(sameMeaning("Tổ 12", "Tổ 1 2")).toBe(false);
    expect(sameMeaning("Tổ 12", "Tổ 21")).toBe(false);
  });
});
