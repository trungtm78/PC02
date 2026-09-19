import { describe, it, expect } from "vitest";
import {
  dungMaTran,
  danhSachGui,
  soSanhMaTran,
  khoaCuaVaiTro,
  type QuyenCap,
} from "../maTranQuyen";

/**
 * Ma trận phân quyền dựng từ DANH MỤC THẬT (`GET /admin/permissions`), không từ lưới cứng. Đo prod 19/09/2026:
 * danh mục 16 nhóm × 9 thao tác; lưới cứng 8×5 cũ chỉ phủ 22/56 quyền ADMIN, 11/17 OFFICER, 0/3
 * DEADLINE_APPROVER — "Lưu" gửi lại lưới cứng là xoá mất phần ngoài lưới.
 */
const DANH_MUC: QuyenCap[] = [
  { action: "read", subject: "Case" },
  { action: "write", subject: "Case" },
  { action: "restore", subject: "Case" },
  { action: "read", subject: "EditWindowResetRequest" },
  { action: "review_reset_request", subject: "EditWindowResetRequest" },
  { action: "read", subject: "User" },
];

describe("dungMaTran", () => {
  it("hàng = mọi subject của danh mục, cột = mọi action của danh mục (kể cả action lạ ngoài bộ nhãn)", () => {
    const mt = dungMaTran(DANH_MUC, []);
    expect(mt.subjects).toEqual(["Case", "EditWindowResetRequest", "User"]);
    expect(mt.actions).toEqual([
      "read",
      "write",
      "restore",
      "review_reset_request",
    ]);
  });

  it("ô có trong danh mục mới tích được; ô không có là null (không phải false)", () => {
    const mt = dungMaTran(DANH_MUC, [{ action: "read", subject: "Case" }]);
    expect(mt.o.Case.read).toBe(true);
    expect(mt.o.Case.write).toBe(false);
    expect(mt.o.User.write).toBeNull();
    expect(mt.o.EditWindowResetRequest.review_reset_request).toBe(false);
  });
});

describe("danhSachGui + soSanhMaTran", () => {
  it("khoaCuaVaiTro: dấu phiên bản = bộ `action:subject` đang giữ", () => {
    expect(
      khoaCuaVaiTro(
        dungMaTran(DANH_MUC, [
          { action: "write", subject: "Case" },
          { action: "read", subject: "User" },
        ]),
      ),
    ).toEqual(["write:Case", "read:User"]);
  });

  it("gửi đúng các ô đang tích; so với bản gốc ra số thêm/bớt", () => {
    const goc = dungMaTran(DANH_MUC, [
      { action: "read", subject: "Case" },
      { action: "write", subject: "Case" },
    ]);
    const moi = structuredClone(goc);
    moi.o.Case.write = false;
    moi.o.Case.restore = true;
    moi.o.User.read = true;

    expect(danhSachGui(moi)).toEqual([
      { action: "read", subject: "Case" },
      { action: "restore", subject: "Case" },
      { action: "read", subject: "User" },
    ]);
    expect(soSanhMaTran(goc, moi)).toEqual({
      them: ["restore:Case", "read:User"],
      bo: ["write:Case"],
    });
  });
});
