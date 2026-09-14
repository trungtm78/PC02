import { describe, it, expect } from "vitest";
import { computeFormErrors } from "../validate";
import type { PetitionFormData } from "../types";

/**
 * Form Đơn thư KHÔNG còn hỏi "Loại đơn thư" (14/09/2026).
 *
 * Hệ cũ chỉ có MỘT ô "Loại thông tin" (Tố giác, Đề nghị, Trình báo, Khiếu nại (QĐTT)…). Hệ mới
 * từng thêm ô thứ hai "Loại đơn thư" bắt buộc theo bốn loại luật — cán bộ phải phân loại hai
 * lần, và 46.499 hồ sơ di trú để trống ô ấy. Nay hai ô gộp một: nhóm hạn giải quyết do máy chủ
 * suy từ danh mục Loại thông tin, nên phép kiểm trên form không được chặn vì thiếu loại.
 */
const nen = (p: Partial<PetitionFormData> = {}): PetitionFormData =>
  ({
    receivedDate: "2026-08-01",
    senderName: "Nguyễn Văn A",
    senderAddress: "12 Lê Lợi",
    senderPhone: "0912345678",
    senderEmail: "",
    senderIsAnonymous: false,
    loaiThongTin: "",
    crimeChinhId: "crime-1",
    detailContent: "Nội dung đơn",
    ...p,
  }) as PetitionFormData;

const coLoiLoai = (msgs: string[]) => msgs.some((m) => /Loại đơn thư|Loại thông tin/.test(m));

describe("Phép kiểm form Đơn thư không chặn vì thiếu loại", () => {
  it("đơn tạo mới chưa chọn Loại thông tin vẫn qua", () => {
    const { msgs, fields } = computeFormErrors(nen(), false);
    expect(coLoiLoai(msgs)).toBe(false);
    expect(fields).not.toContain("field-petitionType");
    expect(msgs).toEqual([]);
  });

  it("sửa đơn chưa có Loại thông tin vẫn qua", () => {
    const { msgs } = computeFormErrors(nen(), true);
    expect(msgs).toEqual([]);
  });

  /** Chỉ gỡ đúng MỘT ô. Các ô bắt buộc khác vẫn nguyên hiệu lực. */
  it("không nới lỏng các ô bắt buộc khác", () => {
    const { msgs } = computeFormErrors(nen({ detailContent: "" }), true);
    expect(msgs).toEqual(["Nội dung là bắt buộc"]);
  });
});
