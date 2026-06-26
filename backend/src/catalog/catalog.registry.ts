// Catalog Registry — nguồn sự thật duy nhất cho enum DANH MỤC (không phải status/workflow).
// kind 'legal': giá trị cố định trong code (pháp lý) — giữ Prisma enum, registry cung cấp nhãn/options/validate đồng nhất.
// kind 'dynamic': giá trị lấy từ bảng Directory (admin thêm runtime, không deploy).
// Xem spec: docs/superpowers/specs/2026-06-26-catalog-registry-dynamic-enums-design.md

export type CatalogValue = { code: string; label: string };

export type CatalogCascade = { parentKey: string; map: Record<string, string[]> };

export type CatalogEntry =
  | {
      key: string;
      kind: 'legal';
      multi?: boolean;
      ref?: string;
      enumName?: string;
      values: CatalogValue[];
      cascade?: CatalogCascade;
    }
  | {
      key: string;
      kind: 'dynamic';
      multi?: boolean;
      source: `directory:${string}`;
      cascade?: CatalogCascade;
    };

export const CATALOG_REGISTRY: Record<string, CatalogEntry> = {
  // ── Legal mẫu (điền đủ ở các PR rollout) ──────────────────────────────────
  LY_DO_KHONG_KHOI_TO: {
    key: 'LY_DO_KHONG_KHOI_TO',
    kind: 'legal',
    multi: true,
    ref: 'Đ.157 BLTTHS 2015',
    enumName: 'LyDoKhongKhoiTo',
    values: [
      { code: 'KHONG_CO_SU_VIEC', label: 'Không có sự việc phạm tội (khoản 1a)' },
      { code: 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM', label: 'Hành vi không cấu thành tội phạm (khoản 1b)' },
      { code: 'NGUOI_THUC_HIEN_CHUA_DU_TUOI', label: 'Người thực hiện chưa đủ tuổi TNHS (khoản 1c)' },
      { code: 'NGUOI_PHAM_TOI_CHET', label: 'Người phạm tội đã chết (khoản 1d)' },
      { code: 'HET_THOI_HIEU', label: 'Hết thời hiệu truy cứu TNHS (khoản 1đ)' },
      // Khoản 1e BLTTHS Đ.157 = "đại xá" (tên enum TOI_PHAM_DA_DUOC_XOA_AN_TICH đặt sai trước đây — giữ code, sửa nhãn).
      { code: 'TOI_PHAM_DA_DUOC_XOA_AN_TICH', label: 'Tội phạm đã được đại xá (khoản 1e)' },
      { code: 'TRUONG_HOP_KHAC', label: 'Trường hợp khác theo quy định BLTTHS (khoản 1g)' },
    ],
  },
  LY_DO_TAM_DINH_CHI_VU_VIEC: {
    key: 'LY_DO_TAM_DINH_CHI_VU_VIEC',
    kind: 'legal',
    multi: true,
    ref: 'Đ.148 BLTTHS 2015',
    enumName: 'LyDoTamDinhChiVuViec',
    values: [
      { code: 'CHUA_CO_KET_QUA_GIAM_DINH', label: 'Chưa có kết quả giám định' },
      { code: 'CHUA_CO_KET_QUA_DINH_GIA', label: 'Chưa có kết quả định giá tài sản' },
      { code: 'CHUA_CO_KET_QUA_TUONG_TRO', label: 'Chưa có kết quả tương trợ tư pháp' },
      { code: 'YEU_CAU_TAI_LIEU_CHUA_CO', label: 'Yêu cầu tài liệu chưa có kết quả' },
      { code: 'BAT_KHA_KHANG', label: 'Lý do bất khả kháng' },
      { code: 'CAN_CU_KHAC', label: 'Căn cứ khác' },
    ],
  },
  LY_DO_TAM_DINH_CHI_VU_AN: {
    key: 'LY_DO_TAM_DINH_CHI_VU_AN',
    kind: 'legal',
    multi: true,
    ref: 'Đ.229 BLTTHS 2015',
    enumName: 'LyDoTamDinhChiVuAn',
    values: [
      { code: 'CHUA_XAC_DINH_BI_CAN', label: 'Chưa xác định được bị can (Đ.229.1.a)' },
      { code: 'KHONG_BIET_BI_CAN_O_DAU', label: 'Không biết rõ bị can đang ở đâu (Đ.229.1.b)' },
      { code: 'BI_CAN_BENH_TAM_THAN', label: 'Bị can bị bệnh tâm thần hoặc hiểm nghèo (Đ.229.1.c)' },
      { code: 'CHUA_CO_KET_QUA_GIAM_DINH', label: 'Chưa có kết quả giám định (Đ.229.1.d)' },
      { code: 'CHUA_CO_KET_QUA_DINH_GIA', label: 'Chưa có kết quả định giá tài sản (Đ.229.1.d)' },
      { code: 'CHUA_CO_KET_QUA_TUONG_TRO', label: 'Chưa có kết quả tương trợ tư pháp (Đ.229.1.d)' },
      { code: 'YEU_CAU_TAI_LIEU_CHUA_CO', label: 'Đã yêu cầu tài liệu nhưng chưa có kết quả (Đ.229.1.đ)' },
      { code: 'BAT_KHA_KHANG', label: 'Bất khả kháng: thiên tai, dịch bệnh (Đ.229.1.e)' },
    ],
  },
  // ── Dynamic mẫu ───────────────────────────────────────────────────────────
  DOCUMENT_TYPE: {
    key: 'DOCUMENT_TYPE',
    kind: 'dynamic',
    source: 'directory:DOCUMENT_TYPE',
  },
};

export function getCatalogEntry(key: string): CatalogEntry {
  const e = CATALOG_REGISTRY[key];
  if (!e) throw new Error(`Catalog key không tồn tại: ${key}`);
  return e;
}
