import { describe, it, expect } from "vitest";
import { buildCreateCasePayload } from "../buildCreateCasePayload";
import { INITIAL_FORM_DATA, type CaseFormData } from "../types";
import {
  LEGACY_FORM_LAYOUT,
  LEGACY_FIELD_TO_COLUMN,
  type LegacyLayoutItem,
} from "@/features/cases/legacy-form-layout.def";

/**
 * CỔNG: mọi ô CHỮ/NGÀY/SỐ của bố cục hệ cũ, khi cán bộ xoá trắng rồi bấm Lưu, phải gửi
 * `null` lên máy chủ.
 *
 * Máy chủ chỉ ghi những khoá CÓ MẶT trong lời gọi. Ô rỗng bị bỏ khỏi payload thì thao tác
 * xoá báo thành công mà giá trị cũ vẫn nằm nguyên dưới cơ sở dữ liệu — cán bộ mở lại thấy
 * thứ mình vừa xoá. Ca kiểm trước liệt kê tay 7 ô nên chỉ chứng minh 7 ô ấy đúng.
 */

const O_VO_HUONG = new Set(["text", "date", "textarea", "number", "select", "crime", "fk"]);

const MUC: LegacyLayoutItem[] = Object.values(LEGACY_FORM_LAYOUT)
  .flat()
  .filter((it) => !it.field.startsWith("statistic.") && O_VO_HUONG.has(it.kind));

const KHOA_DUY_NHAT = Array.from(new Map(MUC.map((it) => [it.field, it])).values());

/**
 * Ngoại lệ có lý do: ô hệ cũ KHÔNG có cột riêng, giá trị gộp vào một cột khác.
 *
 * "Sinh năm" của hệ cũ và "Ngày sinh" của hệ mới là cùng một dữ kiện. Hệ mới giữ một cột
 * `reporterDateOfBirth` kèm cột độ chính xác, nên xoá trắng ô Sinh năm phải xoá cột ấy.
 */
const NGOAI_LE: Readonly<Record<string, string>> = { sinhNamCungCap: "reporterDateOfBirth" };

describe("Xoá trắng bất kỳ ô hệ cũ nào thì giá trị cũ phải mất theo", () => {
  it.each(
    KHOA_DUY_NHAT.map((it) => [
      it.field,
      NGOAI_LE[it.field] ?? LEGACY_FIELD_TO_COLUMN[it.field] ?? it.field,
      it.caption,
    ]),
  )(
    'ô "%s" (cột %s — "%s") xoá trắng thì gửi null',
    (field, cot) => {
      const form = { ...INITIAL_FORM_DATA, caseTitle: "Vụ án thử", [field]: "" } as CaseFormData;
      const p = buildCreateCasePayload(form) as Record<string, unknown>;
      expect(p).toHaveProperty(cot as string);
      expect(p[cot as string]).toBeNull();
    },
  );
});
