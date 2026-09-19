import { api } from "@/lib/api";
import { SUBJECT_TYPE_LABEL, type SubjectType } from "@/shared/enums/subject-status";
import type { MucDaCo } from "./tabs";

interface DoiTuongApi {
  id: string;
  fullName: string;
  type: SubjectType;
  idNumber?: string | null;
}
interface VatChungApi {
  id: string;
  code: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

/**
 * Mục con ĐÃ CÓ của vụ án, để form SỬA hiện chỉ-xem ở tab ĐTBS / Vật chứng — cán bộ thấy mục đã có thì không nhập
 * lại (máy chủ ghi mục gửi lên khi sửa là mục THÊM, 19/09/2026).
 *
 * Nguồn nào lỗi thì trả `null` cho nguồn ấy: tải hỏng phải hiện khác "chưa có mục nào", không thì cán bộ tưởng vụ án
 * trống và nhập lại.
 */
export async function taiMucConDaCo(
  caseId: string,
): Promise<{ doiTuong: MucDaCo[] | null; vatChung: MucDaCo[] | null }> {
  const [doiTuong, vatChung] = await Promise.all([
    api
      .get<{ data: DoiTuongApi[] }>("/subjects", { params: { caseId, limit: 100 } })
      .then((r) =>
        (r.data.data ?? []).map((s) => ({
          id: s.id,
          chinh: s.fullName,
          phu: [SUBJECT_TYPE_LABEL[s.type] ?? s.type, s.idNumber ? `CCCD ${s.idNumber}` : ""]
            .filter(Boolean)
            .join(" · "),
        })),
      )
      .catch(() => null),
    api
      .get<{ data: VatChungApi[] }>(`/cases/${caseId}/evidences`)
      .then((r) =>
        (r.data.data ?? []).map((e) => ({
          id: e.id,
          chinh: `${e.code} · ${e.name}`,
          phu: `${e.quantity ?? 1} ${e.unit ?? "cái"}`,
        })),
      )
      .catch(() => null),
  ]);
  return { doiTuong, vatChung };
}
