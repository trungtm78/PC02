/**
 * Nguồn 7 mã loại chứng từ đơn thư (khớp PETITION_DOC_TYPES backend —
 * backend/src/document-templates/petition-seed.ts) + helper tải/lỗi blob.
 * Dùng cho IN ĐỒNG LOẠT (PetitionListPageShell, ExportReportsPage) → POST
 * /petitions/export-document-batch (engine ĐỘNG). In từng/nhiều mẫu cho 1 đơn dùng
 * DynamicExportDocumentsModal (popup "In chứng từ").
 */
export interface DocTypeOption {
  value: string;
  label: string;
  description: string;
}

export const DOC_TYPES: DocTypeOption[] = [
  { value: "BIEN_NHAN", label: "Biên nhận", description: "Biên nhận tiếp nhận đơn thư — xác nhận đã nhận hồ sơ" },
  { value: "PHIEU_DE_XUAT", label: "Phiếu đề xuất", description: "Báo cáo đề xuất xử lý đơn thư lên Ban CH PC02 + Ban CH Đội" },
  { value: "PHIEU_CHUYEN_NGUON_TIN", label: "Phiếu chuyển nguồn tin", description: "Chuyển nguồn tin về tội phạm (Mẫu 03 TT 128/2025/TT-BCA)" },
  { value: "PHIEU_CHUYEN_DON", label: "Phiếu chuyển đơn", description: "Chuyển đơn cho Tổ công tác giải quyết theo thẩm quyền" },
  { value: "THONG_BAO_CHUYEN", label: "Thông báo chuyển đơn", description: "Thông báo cho người gửi: đơn đã được chuyển đến đơn vị có thẩm quyền" },
  { value: "THONG_BAO_HUONG_DAN", label: "Thông báo hướng dẫn", description: "Hướng dẫn người gửi khởi kiện ra Tòa án nhân dân" },
  { value: "THONG_BAO_TRA_LAI", label: "Thông báo trả lại đơn", description: "Trả lại đơn cho người gửi để bổ sung, hoàn thiện" },
];

/**
 * Khi tải file qua axios `responseType: 'blob'`, lỗi (400/...) cũng về dạng Blob.
 * Parse Blob-JSON về object để extractApiError đọc message nghiệp vụ.
 */
export async function parseBlobError(err: unknown): Promise<unknown> {
  const e = err as { response?: { data?: unknown } };
  const data = e?.response?.data;
  if (data instanceof Blob && data.type.includes("json")) {
    try {
      const text = await data.text();
      (e as { response: { data: unknown } }).response.data = JSON.parse(text);
    } catch {
      /* ignore — extractApiError fallback sẽ chạy */
    }
  }
  return err;
}
