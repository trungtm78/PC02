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
      { code: 'KHONG_CO_SU_VIEC', label: 'Không có sự việc phạm tội' },
      { code: 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM', label: 'Hành vi không cấu thành tội phạm' },
      { code: 'NGUOI_THUC_HIEN_CHUA_DU_TUOI', label: 'Người thực hiện chưa đủ tuổi chịu TNHS' },
      { code: 'NGUOI_PHAM_TOI_CHET', label: 'Người phạm tội đã chết' },
      { code: 'HET_THOI_HIEU', label: 'Hết thời hiệu truy cứu TNHS' },
      { code: 'TOI_PHAM_DA_DUOC_XOA_AN_TICH', label: 'Tội phạm đã được xóa án tích' },
      { code: 'TRUONG_HOP_KHAC', label: 'Trường hợp khác' },
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
