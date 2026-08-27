import { describe, it, expect } from "vitest";
import { computeFormErrors } from "../validate";
import type { PetitionFormData } from "../types";

/**
 * Ô "Loại đơn thư" không được chặn Lưu một hồ sơ DI TRÚ.
 *
 * Hệ cũ không có khái niệm này — cả 46.499 hồ sơ di trú đều để trống, đo trên máy chạy
 * 27/08/2026. Bắt buộc nó nghĩa là cán bộ mở bất kỳ hồ sơ cũ nào ra cũng phải phân loại lại
 * trước khi sửa nổi một dấu phẩy, và phải tự phán đoán pháp lý: hệ cũ ghi "Tố giác" (21.662
 * hồ sơ), "Đề nghị" (9.056), "Trình báo" (5.742), trong khi hệ mới chỉ có bốn loại theo Luật
 * Tố cáo 2018 và Luật Khiếu nại 2011. *Tố giác tội phạm* (BLTTHS) và *tố cáo* không phải một
 * thứ, nên ngay cả dòng đông nhất cũng không có câu trả lời hiển nhiên.
 *
 * Nguyên tắc của epic là cán bộ dùng hệ cũ KHÔNG PHẢI HỌC LẠI. Dựng thêm một cửa mà hệ cũ
 * chưa từng có là đi ngược đúng nguyên tắc ấy.
 *
 * Đơn TẠO MỚI vẫn bắt buộc — đó là yêu cầu thật của hệ mới, và người tạo đơn là người đang
 * cầm hồ sơ nên phân loại được.
 */
const nen = (p: Partial<PetitionFormData> = {}): PetitionFormData =>
  ({
    receivedDate: "2026-08-01",
    senderName: "Nguyễn Văn A",
    senderAddress: "12 Lê Lợi",
    senderPhone: "0912345678",
    senderEmail: "",
    senderIsAnonymous: false,
    petitionType: "",
    crimeChinhId: "crime-1",
    detailContent: "Nội dung đơn",
    ...p,
  }) as PetitionFormData;

const coLoiLoaiDon = (msgs: string[]) => msgs.some((m) => /Loại đơn thư/.test(m));

describe('Ô "Loại đơn thư" và hồ sơ di trú', () => {
  it("hồ sơ di trú để trống loại đơn thì KHÔNG bị chặn", () => {
    const { msgs } = computeFormErrors(nen(), true, true);
    expect(coLoiLoaiDon(msgs)).toBe(false);
    expect(msgs).toEqual([]);
  });

  it("đơn tạo mới vẫn bắt buộc", () => {
    const { msgs } = computeFormErrors(nen(), false, false);
    expect(coLoiLoaiDon(msgs)).toBe(true);
  });

  it("sửa đơn của hệ mới vẫn bắt buộc — không phải hồ sơ di trú thì không được miễn", () => {
    const { msgs } = computeFormErrors(nen(), true, false);
    expect(coLoiLoaiDon(msgs)).toBe(true);
  });

  /**
   * Miễn vì hệ cũ KHÔNG CÓ giá trị, không phải vì hồ sơ cũ thì muốn ghi gì cũng được. Cán bộ
   * đã chọn một loại thì loại ấy vẫn phải hợp lệ.
   */
  it("hồ sơ di trú mà chọn giá trị lạ thì vẫn báo lỗi", () => {
    const { msgs } = computeFormErrors(nen({ petitionType: "KHONG_CO_THAT" }), true, true);
    expect(coLoiLoaiDon(msgs)).toBe(true);
  });

  it("hồ sơ di trú chọn đúng một loại hợp lệ thì qua", () => {
    const { msgs } = computeFormErrors(nen({ petitionType: "TO_CAO" }), true, true);
    expect(coLoiLoaiDon(msgs)).toBe(false);
  });

  /** Miễn đúng MỘT ô. Các ô bắt buộc khác vẫn nguyên hiệu lực với hồ sơ di trú. */
  it("không nới lỏng các ô bắt buộc khác", () => {
    const { msgs } = computeFormErrors(nen({ detailContent: "" }), true, true);
    expect(msgs).toContain("Nội dung là bắt buộc");
  });
});
