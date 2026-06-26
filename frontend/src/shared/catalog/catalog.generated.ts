// AUTO-GENERATED bởi backend/scripts/generate-catalog.cjs — KHÔNG sửa tay.
// Nguồn: backend/src/catalog/catalog.registry.ts. Chạy lại: npm run gen:catalog

export type CatalogOption = { code: string; label: string };

export const CATALOG_LEGAL = {
  "LY_DO_KHONG_KHOI_TO": [
    {
      "code": "KHONG_CO_SU_VIEC",
      "label": "Không có sự việc phạm tội (khoản 1a)"
    },
    {
      "code": "HANH_VI_KHONG_CAU_THANH_TOI_PHAM",
      "label": "Hành vi không cấu thành tội phạm (khoản 1b)"
    },
    {
      "code": "NGUOI_THUC_HIEN_CHUA_DU_TUOI",
      "label": "Người thực hiện chưa đủ tuổi TNHS (khoản 1c)"
    },
    {
      "code": "NGUOI_PHAM_TOI_CHET",
      "label": "Người phạm tội đã chết (khoản 1d)"
    },
    {
      "code": "HET_THOI_HIEU",
      "label": "Hết thời hiệu truy cứu TNHS (khoản 1đ)"
    },
    {
      "code": "TOI_PHAM_DA_DUOC_XOA_AN_TICH",
      "label": "Tội phạm đã được đại xá (khoản 1e)"
    },
    {
      "code": "TRUONG_HOP_KHAC",
      "label": "Trường hợp khác theo quy định BLTTHS (khoản 1g)"
    }
  ]
} as const;

export const CATALOG_DYNAMIC_KEYS = ["DOCUMENT_TYPE"] as const;

export const CATALOG_META = {
  "LY_DO_KHONG_KHOI_TO": {
    "kind": "legal",
    "multi": true
  },
  "DOCUMENT_TYPE": {
    "kind": "dynamic",
    "multi": false
  }
} as const;
