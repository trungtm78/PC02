import { describe, it, expect } from "vitest";
import { buildCreateCasePayload } from "../buildCreateCasePayload";
import { INITIAL_FORM_DATA } from "../types";
import type { Subject } from "../types";

/**
 * Đối tượng nhập qua form phải đi lên máy chủ.
 *
 * Trước bản vá này, payload lọc bỏ mọi đối tượng không có `crimeId` — mà hộp thoại thêm
 * đối tượng KHÔNG hề có ô tội danh, nên không đối tượng nào từng có `crimeId`. Hệ quả: cán
 * bộ thêm bị can, bấm Lưu, hệ thống báo thành công, và danh sách bị can rỗng. Máy chủ vốn
 * khai `crimeId` là tuỳ chọn (nhân chứng, bị hại không cần tội danh), nên bộ lọc ấy chặn
 * nhầm ngay từ đầu.
 *
 * Bản vá này còn là điều kiện để cột "Đối tượng bị can" trên danh sách vụ án có dữ liệu.
 */

const biCan: Subject = {
  id: "s1",
  type: "Bị can",
  name: "Nguyễn Văn A",
  idNumber: "079123456789",
  dateOfBirth: "1990-01-01",
  address: "Phường Bến Nghé",
  phone: "0901234567",
  gender: "MALE",
  nationality: "",
  occupation: "",
  criminalRecord: "",
  detentionStatus: "",
} as Subject;

function payload(subjects: Subject[]) {
  return buildCreateCasePayload(
    { ...INITIAL_FORM_DATA, caseTitle: "Vụ án thử", caseProvenance: "DIRECT_DISCOVERY" },
    { subjects },
  ) as Record<string, unknown>;
}

describe("Đối tượng nhập trên form không bị mất khi lưu", () => {
  it("giữ bị can dù chưa chọn tội danh — máy chủ vốn không bắt buộc", () => {
    const p = payload([biCan]);
    const ds = p.subjects as { fullName: string; type: string }[];
    expect(ds).toHaveLength(1);
    expect(ds[0].fullName).toBe("Nguyễn Văn A");
    expect(ds[0].type).toBe("SUSPECT");
  });

  it("giữ cả bị hại và nhân chứng", () => {
    const p = payload([
      { ...biCan, id: "s2", type: "Bị hại", name: "Trần Thị B" },
      { ...biCan, id: "s3", type: "Nhân chứng", name: "Lê Văn C" },
    ]);
    const ds = p.subjects as { fullName: string; type: string }[];
    expect(ds.map((s) => s.type)).toEqual(["VICTIM", "WITNESS"]);
  });

  /**
   * "Luật sư" vẫn phải loại khỏi mảng đối tượng — bảng Subject của máy chủ chỉ có ba loại,
   * gửi lên là 400 và hỏng cả lần lưu. Nhưng loại nó KHÔNG được im lặng: hộp thoại vẫn cho
   * chọn "Luật sư", nên cán bộ cần biết mục ấy đi đường khác.
   */
  it("loại Luật sư khỏi mảng đối tượng nhưng báo lại, không nuốt lặng", () => {
    const bienNhan: string[] = [];
    const p = buildCreateCasePayload(
      { ...INITIAL_FORM_DATA, caseTitle: "Vụ án thử", caseProvenance: "DIRECT_DISCOVERY" },
      {
        subjects: [biCan, { ...biCan, id: "s9", type: "Luật sư", name: "LS Phạm D" }],
        onSubjectBiLoai: (ten, lyDo) => bienNhan.push(`${ten}: ${lyDo}`),
      },
    ) as Record<string, unknown>;

    expect((p.subjects as unknown[]).length).toBe(1);
    expect(bienNhan).toEqual(["LS Phạm D: Luật sư lưu ở danh sách luật sư, không thuộc danh sách đối tượng"]);
  });

  /**
   * Máy chủ dùng `@IsOptional()`, mà `@IsOptional()` coi CHUỖI RỖNG là có giá trị nên vẫn
   * chạy tiếp `@IsDateString()`. Gửi `dateOfBirth: ""` là 400 và hỏng CẢ lần lưu hồ sơ chỉ
   * vì một ô trống của một đối tượng.
   */
  it("ô để trống bị bỏ hẳn khỏi payload, không gửi chuỗi rỗng", () => {
    const p = payload([
      { ...biCan, dateOfBirth: "", address: "", idNumber: "", gender: "", criminalRecord: "" } as Subject,
    ]);
    const s0 = (p.subjects as Record<string, unknown>[])[0];
    expect(s0.fullName).toBe("Nguyễn Văn A");
    for (const k of ["dateOfBirth", "address", "idNumber", "gender", "notes"]) {
      expect(s0[k], `ô "${k}" rỗng phải bỏ hẳn, không gửi chuỗi rỗng`).toBeUndefined();
    }
  });

  it("không có đối tượng nào thì không gửi khoá subjects", () => {
    expect(payload([]).subjects).toBeUndefined();
  });
});
