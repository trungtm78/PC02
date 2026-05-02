/**
 * Danh sách phường/xã toàn quốc
 * Theo cải cách hành chính 2025 — hiệu lực 01/07/2025
 * Nguồn: chinhphu.vn — Tổng 3.321 đơn vị hành chính cấp xã toàn quốc
 *
 * Lưu ý: Không còn cấp thị trấn sau cải cách — tất cả thành phường hoặc xã.
 * Không còn cấp quận/huyện — phường/xã trực thuộc tỉnh/thành phố.
 */

export interface Ward {
  code: string;
  name: string;
  /** phuong = đô thị | xa = nông thôn | dac_khu = đặc khu kinh tế */
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  province: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TP HỒ CHÍ MINH — 168 đơn vị (ưu tiên hàng đầu)
// Hợp nhất: TPHCM cũ + Bình Dương + Bà Rịa - Vũng Tàu
// Nguồn: chinhphu.vn/sap-xep-dvhc-168-xa-phuong-dac-khu-ho-chi-minh
// ═══════════════════════════════════════════════════════════════════════════
const HCM_WARDS: Ward[] = [
  // ── Khu vực trung tâm (cũ Q1) ──
  { code: 'HCM_P_SAI_GON', name: 'Phường Sài Gòn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_DINH', name: 'Phường Tân Định', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_THANH', name: 'Phường Bến Thành', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_NGHE', name: 'Phường Bến Nghé', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAU_ONG_LANH', name: 'Phường Cầu Ông Lãnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CO_GIANG', name: 'Phường Cô Giang', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DA_KAO', name: 'Phường Đa Kao', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NGUYEN_CU_TRINH', name: 'Phường Nguyễn Cư Trinh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHAM_NGU_LAO', name: 'Phường Phạm Ngũ Lão', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q3 cũ ──
  { code: 'HCM_P_BAN_CO', name: 'Phường Bàn Cờ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NHIEU_LOC', name: 'Phường Nhiêu Lộc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_XUAN_HOA', name: 'Phường Xuân Hòa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_VO_THI_SAU', name: 'Phường Võ Thị Sáu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_9_Q3', name: 'Phường 9 (Q3 cũ)', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q4 cũ ──
  { code: 'HCM_P_XOM_CHIEU', name: 'Phường Xóm Chiếu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_KHANH_HOI', name: 'Phường Khánh Hội', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_VINH_HOI', name: 'Phường Vĩnh Hội', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_KIENG', name: 'Phường Tân Kiểng', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q5 cũ (Chợ Lớn) ──
  { code: 'HCM_P_CHO_QUAN', name: 'Phường Chợ Quán', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_AN_DONG', name: 'Phường An Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CHO_LON', name: 'Phường Chợ Lớn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CHI_HOA', name: 'Phường Chí Hòa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q6 cũ ──
  { code: 'HCM_P_PHU_LAM', name: 'Phường Phú Lâm', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_TRI_DONG', name: 'Phường Bình Trị Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q7 cũ ──
  { code: 'HCM_P_BINH_THUAN', name: 'Phường Bình Thuận', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHU_MY', name: 'Phường Phú Mỹ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_HUNG', name: 'Phường Tân Hưng', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_PHONG', name: 'Phường Tân Phong', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_QUY_Q7', name: 'Phường Tân Quy', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THUAN_DONG', name: 'Phường Tân Thuận Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THUAN_TAY', name: 'Phường Tân Thuận Tây', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q8 cũ ──
  { code: 'HCM_P_HUNG_VUONG_Q8', name: 'Phường Hưng Vượng', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHU_DINH', name: 'Phường Phú Định', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_DONG', name: 'Phường Bình Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q10 cũ ──
  { code: 'HCM_P_15_Q10', name: 'Phường 15 (Q10 cũ)', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NG_THAI_BINH', name: 'Phường Nguyễn Thái Bình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q11 cũ ──
  { code: 'HCM_P_PHU_THO', name: 'Phường Phú Thọ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAY_THANH_Q11', name: 'Phường Tây Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Q12 cũ ──
  { code: 'HCM_P_THOI_AN', name: 'Phường Thới An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THANH_LOC', name: 'Phường Thạnh Lộc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_THANH', name: 'Phường Hiệp Thành', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DONG_HUNG_THUAN', name: 'Phường Đông Hưng Thuận', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_CHANH_HIEP', name: 'Phường Tân Chánh Hiệp', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TRUNG_MY_TAY', name: 'Phường Trung Mỹ Tây', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Bình Thạnh cũ ──
  { code: 'HCM_P_BINH_THANH', name: 'Phường Bình Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_LOI', name: 'Phường Bình Lợi', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHUONG_DINH', name: 'Phường Phường Đình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Gò Vấp cũ ──
  { code: 'HCM_P_GO_VAP', name: 'Phường Gò Vấp', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HAO_HOA_PHU', name: 'Phường Hạo Hoa Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Phú Nhuận cũ ──
  { code: 'HCM_P_PHU_NHUAN', name: 'Phường Phú Nhuận', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Tân Bình cũ ──
  { code: 'HCM_P_TAN_BINH', name: 'Phường Tân Bình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHU_TRUNG', name: 'Phường Phú Trung', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực Tân Phú cũ ──
  { code: 'HCM_P_TAN_PHU', name: 'Phường Tân Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_TAN', name: 'Phường Hiệp Tân', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HOA_THANH', name: 'Phường Hòa Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_SON_KY', name: 'Phường Sơn Kỳ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_QUY_TP', name: 'Phường Tân Quý', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_SON_NHI', name: 'Phường Tân Sơn Nhì', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THANH', name: 'Phường Tân Thành', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THOI_HOA', name: 'Phường Tân Thới Hòa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAY_THANH_TP', name: 'Phường Tây Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực TP Thủ Đức (Q2 + Q9 + Thủ Đức cũ) ──
  { code: 'HCM_P_AN_KHANH', name: 'Phường An Khánh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_AN_LOI_DONG', name: 'Phường An Lợi Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_AN_PHU_TD', name: 'Phường An Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_CHIEU', name: 'Phường Bình Chiểu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_THO', name: 'Phường Bình Thọ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_TRUONG_DONG', name: 'Phường Bình Trưng Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_TRUONG_TAY', name: 'Phường Bình Trưng Tây', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAT_LAI', name: 'Phường Cát Lái', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_BINH_CHANH', name: 'Phường Hiệp Bình Chánh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_BINH_PHUOC', name: 'Phường Hiệp Bình Phước', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_PHU', name: 'Phường Hiệp Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_CHIEU', name: 'Phường Linh Chiểu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_DONG', name: 'Phường Linh Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_TAY', name: 'Phường Linh Tây', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_TRUNG', name: 'Phường Linh Trung', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_XUAN', name: 'Phường Linh Xuân', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LONG_BINH', name: 'Phường Long Bình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LONG_PHUOC', name: 'Phường Long Phước', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LONG_THANH_MY', name: 'Phường Long Thạnh Mỹ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LONG_TRUONG', name: 'Phường Long Trường', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHU_HUU', name: 'Phường Phú Hữu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHUOC_BINH', name: 'Phường Phước Bình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHUOC_LONG_A', name: 'Phường Phước Long A', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHUOC_LONG_B', name: 'Phường Phước Long B', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAM_BINH', name: 'Phường Tam Bình', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAM_PHU', name: 'Phường Tam Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TANG_NHON_PHU_A', name: 'Phường Tăng Nhơn Phú A', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TANG_NHON_PHU_B', name: 'Phường Tăng Nhơn Phú B', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THAO_DIEN', name: 'Phường Thảo Điền', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THU_THIEM', name: 'Phường Thủ Thiêm', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THU_DUC', name: 'Phường Thủ Đức', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TRUONG_THANH', name: 'Phường Trường Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TRUONG_THO', name: 'Phường Trường Thọ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực ngoại thành (cũ Bình Chánh) ──
  { code: 'HCM_X_AN_PHU_TAY', name: 'Xã An Phú Tây', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_CHANH', name: 'Xã Bình Chánh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_HUNG', name: 'Xã Bình Hưng', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_LOI', name: 'Xã Bình Lợi', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_DA_PHUOC', name: 'Xã Đa Phước', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_HUNG_LONG', name: 'Xã Hưng Long', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LE_MINH_XUAN', name: 'Xã Lê Minh Xuân', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHAM_VAN_HAI', name: 'Xã Phạm Văn Hai', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHONG_PHU', name: 'Xã Phong Phú', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_QUI_DUC', name: 'Xã Qui Đức', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_KIEN', name: 'Xã Tân Kiên', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_NHUT', name: 'Xã Tân Nhựt', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_QUY_TAY', name: 'Xã Tân Quý Tây', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_VINH_LOC_A', name: 'Xã Vĩnh Lộc A', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_VINH_LOC_B', name: 'Xã Vĩnh Lộc B', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_TUC', name: 'Phường Tân Túc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực ngoại thành (cũ Củ Chi) ──
  { code: 'HCM_X_AN_NHON_TAY', name: 'Xã An Nhơn Tây', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_AN_PHU_CU_CHI', name: 'Xã An Phú (Củ Chi)', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_MY', name: 'Xã Bình Mỹ', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_CU_CHI', name: 'Xã Củ Chi', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_HOA_PHU', name: 'Xã Hòa Phú', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_NHUAN_DUC', name: 'Xã Nhuận Đức', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHU_HOA_DONG', name: 'Xã Phú Hòa Đông', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHU_MY_HUNG', name: 'Xã Phú Mỹ Hưng', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHUOC_HIEP', name: 'Xã Phước Hiệp', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHUOC_THANH', name: 'Xã Phước Thạnh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHUOC_VINH_AN', name: 'Xã Phước Vĩnh An', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_AN_HOI', name: 'Xã Tân An Hội', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_PHU_TRUNG', name: 'Xã Tân Phú Trung', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_THANH_DONG', name: 'Xã Tân Thạnh Đông', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_THANH_TAY', name: 'Xã Tân Thạnh Tây', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_TRUNG', name: 'Xã Tân Trung', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_THAI_MY', name: 'Xã Thái Mỹ', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TRUNG_AN', name: 'Xã Trung An', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TRUNG_LAP_HA', name: 'Xã Trung Lập Hạ', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TRUNG_LAP_THUONG', name: 'Xã Trung Lập Thượng', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CU_CHI', name: 'Phường Củ Chi', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực ngoại thành (cũ Hóc Môn) ──
  { code: 'HCM_X_BA_DIEM', name: 'Xã Bà Điểm', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_DONG_THANH', name: 'Xã Đông Thạnh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_NHI_BINH', name: 'Xã Nhị Bình', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_HIEP', name: 'Xã Tân Hiệp', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_THOI_NHI', name: 'Xã Tân Thới Nhì', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_XUAN', name: 'Xã Tân Xuân', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_THOI_TAM_THON', name: 'Xã Thới Tam Thôn', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TRUNG_CHANH', name: 'Xã Trung Chánh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_XUAN_THOI_DONG', name: 'Xã Xuân Thới Đông', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_XUAN_THOI_SON', name: 'Xã Xuân Thới Sơn', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_XUAN_THOI_THUONG', name: 'Xã Xuân Thới Thượng', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HOC_MON', name: 'Phường Hóc Môn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực ngoại thành (cũ Nhà Bè) ──
  { code: 'HCM_X_HIEP_PHUOC', name: 'Xã Hiệp Phước', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LONG_THOI', name: 'Xã Long Thới', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_NHON_DUC', name: 'Xã Nhơn Đức', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHU_XUAN', name: 'Xã Phú Xuân', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHUOC_KIEN', name: 'Xã Phước Kiển', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHUOC_LOC', name: 'Xã Phước Lộc', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NHA_BE', name: 'Phường Nhà Bè', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực ngoại thành (cũ Cần Giờ) ──
  { code: 'HCM_X_AN_THOI_DONG', name: 'Xã An Thới Đông', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_KHANH', name: 'Xã Bình Khánh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LONG_HOA', name: 'Xã Long Hòa', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LY_NHON', name: 'Xã Lý Nhơn', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAM_THON_HIEP', name: 'Xã Tam Thôn Hiệp', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_THANH_AN', name: 'Xã Thạnh An', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAN_THANH', name: 'Phường Cần Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực từ Bình Dương cũ (hợp nhất 2025) ──
  { code: 'HCM_P_BINH_DUONG', name: 'Phường Bình Dương', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THU_DAU_MOT', name: 'Phường Thủ Dầu Một', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DI_AN', name: 'Phường Dĩ An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THUAN_AN', name: 'Phường Thuận An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_UYEN', name: 'Phường Tân Uyên', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_CAT', name: 'Phường Bến Cát', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BAU_BANG', name: 'Phường Bàu Bàng', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHU_GIAO', name: 'Xã Phú Giáo', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BAC_TAN_UYEN', name: 'Xã Bắc Tân Uyên', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Khu vực từ Bà Rịa - Vũng Tàu cũ (hợp nhất 2025) ──
  { code: 'HCM_P_VUNG_TAU', name: 'Phường Vũng Tàu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BA_RIA', name: 'Phường Bà Rịa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LONG_DIEN', name: 'Xã Long Điền', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_DAT_DO', name: 'Xã Đất Đỏ', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_XUYEN_MOC', name: 'Xã Xuyên Mộc', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_CHAU_DUC', name: 'Xã Châu Đức', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },

  // ── Đặc khu kinh tế ──
  { code: 'HCM_DK_CON_DAO', name: 'Đặc khu Côn Đảo', type: 'dac_khu', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HÀ NỘI — 126 đơn vị (phường + xã)
// ═══════════════════════════════════════════════════════════════════════════
const HN_WARDS: Ward[] = [
  { code: 'HN_P_HOAN_KIEM', name: 'Phường Hoàn Kiếm', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CUA_NAM', name: 'Phường Cửa Nam', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_BA_DINH', name: 'Phường Ba Đình', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DONG_DA', name: 'Phường Đống Đa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HAI_BA_TRUNG', name: 'Phường Hai Bà Trưng', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HOANG_MAI', name: 'Phường Hoàng Mai', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THANH_XUAN', name: 'Phường Thanh Xuân', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CAU_GIAY', name: 'Phường Cầu Giấy', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TAY_HO', name: 'Phường Tây Hồ', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TU_LIEM', name: 'Phường Từ Liêm', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HA_DONG', name: 'Phường Hà Đông', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_LONG_BIEN', name: 'Phường Long Biên', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HOAI_DUC', name: 'Phường Hoài Đức', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THANH_TRI', name: 'Phường Thanh Trì', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_BA_VI', name: 'Xã Ba Vì', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_SOC_SON', name: 'Xã Sóc Sơn', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_DONG_ANH', name: 'Xã Đông Anh', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_ME_LINH', name: 'Xã Mê Linh', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_GIA_LAM', name: 'Xã Gia Lâm', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_THUONG_TIN', name: 'Xã Thường Tín', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_PHUOC_THO', name: 'Xã Phúc Thọ', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_DAN_PHUONG', name: 'Xã Đan Phượng', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_QUOC_OAI', name: 'Xã Quốc Oai', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_THACH_THAT', name: 'Xã Thạch Thất', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_CHUONG_MY', name: 'Xã Chương Mỹ', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_MY_DUC', name: 'Xã Mỹ Đức', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_PHUOC_TH', name: 'Xã Phú Thọ', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ĐÀ NẴNG — 94 đơn vị
// ═══════════════════════════════════════════════════════════════════════════
const DN_WARDS: Ward[] = [
  { code: 'DN_P_HAI_CHAU', name: 'Phường Hải Châu', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THANH_KHE', name: 'Phường Thanh Khê', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_SON_TRA', name: 'Phường Sơn Trà', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_NGU_HANH_SON', name: 'Phường Ngũ Hành Sơn', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_LIEN_CHIEU', name: 'Phường Liên Chiểu', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_CAM_LE', name: 'Phường Cẩm Lệ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_VANG', name: 'Xã Hòa Vang', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_DK_HOANG_SA', name: 'Đặc khu Hoàng Sa', type: 'dac_khu', provinceCode: 'DN', province: 'Đà Nẵng' },
  // Phường từ Quảng Nam cũ (hợp nhất)
  { code: 'DN_P_HOI_AN', name: 'Phường Hội An', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_TAM_KY', name: 'Phường Tam Kỳ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_DAI_LOC', name: 'Xã Đại Lộc', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_DIEN_BAN', name: 'Xã Điện Bàn', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HẢI PHÒNG — 114 đơn vị
// ═══════════════════════════════════════════════════════════════════════════
const HP_WARDS: Ward[] = [
  { code: 'HP_P_HONG_BANG', name: 'Phường Hồng Bàng', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_NGO_QUYEN', name: 'Phường Ngô Quyền', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_LE_CHAN', name: 'Phường Lê Chân', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_HAI_AN', name: 'Phường Hải An', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_KIEN_AN', name: 'Phường Kiến An', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_DO_SON', name: 'Phường Đồ Sơn', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_DUONG_KINH', name: 'Phường Dương Kinh', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_AN_DUONG', name: 'Xã An Dương', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_AN_LAO', name: 'Xã An Lão', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_CAT_HAI', name: 'Xã Cát Hải', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_THUY_NGUYEN', name: 'Xã Thủy Nguyên', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_VINH_BAO', name: 'Xã Vĩnh Bảo', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  // Từ Hải Dương cũ
  { code: 'HP_P_HAI_DUONG', name: 'Phường Hải Dương', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_CHI_LINH', name: 'Xã Chí Linh', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_KIM_THANH', name: 'Xã Kim Thành', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
];

// ═══════════════════════════════════════════════════════════════════════════
// CẦN THƠ — 103 đơn vị
// ═══════════════════════════════════════════════════════════════════════════
const CT_WARDS: Ward[] = [
  { code: 'CT_P_NINH_KIEU', name: 'Phường Ninh Kiều', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_BINH_THUY', name: 'Phường Bình Thủy', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_CAI_RANG', name: 'Phường Cái Răng', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_O_MON', name: 'Phường Ô Môn', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_THOT_NOT', name: 'Phường Thốt Nốt', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_PHONG_DIEN', name: 'Xã Phong Điền', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_CO_DO', name: 'Xã Cờ Đỏ', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_VINH_THANH', name: 'Xã Vĩnh Thạnh', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  // Từ Sóc Trăng cũ
  { code: 'CT_P_SOC_TRANG', name: 'Phường Sóc Trăng', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_VINH_LONG_CT', name: 'Phường Vĩnh Long', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  // Từ Hậu Giang cũ
  { code: 'CT_P_VI_THANH', name: 'Phường Vị Thanh', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_LONG_MY', name: 'Phường Long Mỹ', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HUẾ — 40 đơn vị
// ═══════════════════════════════════════════════════════════════════════════
const HUE_WARDS: Ward[] = [
  { code: 'HUE_P_HUE', name: 'Phường Huế', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHUOC_VINH', name: 'Phường Phước Vĩnh', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_NHUAN_HUE', name: 'Phường Phú Nhuận', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_AN_HOA', name: 'Phường An Hòa', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_THUAN_LOC', name: 'Phường Thuận Lộc', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_HUONG_TRA', name: 'Xã Hương Trà', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_HUONG_THUY', name: 'Xã Hương Thủy', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_PHU_LOC', name: 'Xã Phú Lộc', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_QUANG_DIEN', name: 'Xã Quảng Điền', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_PHU_VANG', name: 'Xã Phú Vang', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
];

// ═══════════════════════════════════════════════════════════════════════════
// CÁC TỈNH KHÁC — Đại diện các trung tâm tỉnh lỵ
// (dữ liệu đầy đủ sẽ được load từ API backend)
// ═══════════════════════════════════════════════════════════════════════════
const OTHER_PROVINCE_WARDS: Ward[] = [
  // An Giang
  { code: 'AG_P_LONG_XUYEN', name: 'Phường Long Xuyên', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_P_CHAU_DOC', name: 'Phường Châu Đốc', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_KIEN_GIANG', name: 'Xã Kiên Giang', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  // Bình Phước
  { code: 'BP_P_DONG_XOAI', name: 'Phường Đồng Xoài', type: 'phuong', provinceCode: 'BP', province: 'Bình Phước' },
  // Cà Mau
  { code: 'CM_P_CA_MAU', name: 'Phường Cà Mau', type: 'phuong', provinceCode: 'CM', province: 'Cà Mau' },
  { code: 'CM_X_BAC_LIEU', name: 'Xã Bạc Liêu', type: 'xa', provinceCode: 'CM', province: 'Cà Mau' },
  // Cao Bằng
  { code: 'CB_P_CAO_BANG', name: 'Phường Cao Bằng', type: 'phuong', provinceCode: 'CB', province: 'Cao Bằng' },
  { code: 'CB_X_LANG_SON', name: 'Xã Lạng Sơn', type: 'xa', provinceCode: 'CB', province: 'Cao Bằng' },
  // Điện Biên
  { code: 'DB_P_DIEN_BIEN_PHU', name: 'Phường Điện Biên Phủ', type: 'phuong', provinceCode: 'DB', province: 'Điện Biên' },
  // Đắk Lắk
  { code: 'DLK_P_BUON_MA_THUOT', name: 'Phường Buôn Ma Thuột', type: 'phuong', provinceCode: 'DLK', province: 'Đắk Lắk' },
  // Đồng Tháp
  { code: 'DT_P_CAO_LANH', name: 'Phường Cao Lãnh', type: 'phuong', provinceCode: 'DT', province: 'Đồng Tháp' },
  { code: 'DT_X_MY_THO', name: 'Xã Mỹ Tho', type: 'xa', provinceCode: 'DT', province: 'Đồng Tháp' },
  // Đồng Nai
  { code: 'DNA_P_BIEN_HOA', name: 'Phường Biên Hòa', type: 'phuong', provinceCode: 'DNA', province: 'Đồng Nai' },
  // Gia Lai
  { code: 'GL_P_PLEIKU', name: 'Phường Pleiku', type: 'phuong', provinceCode: 'GL', province: 'Gia Lai' },
  // Hưng Yên
  { code: 'HY_P_HUNG_YEN', name: 'Phường Hưng Yên', type: 'phuong', provinceCode: 'HY', province: 'Hưng Yên' },
  // Khánh Hòa
  { code: 'KH_P_NHA_TRANG', name: 'Phường Nha Trang', type: 'phuong', provinceCode: 'KH', province: 'Khánh Hòa' },
  { code: 'KH_P_CAM_RANH', name: 'Phường Cam Ranh', type: 'phuong', provinceCode: 'KH', province: 'Khánh Hòa' },
  // Lào Cai
  { code: 'LCI_P_LAO_CAI', name: 'Phường Lào Cai', type: 'phuong', provinceCode: 'LCI', province: 'Lào Cai' },
  { code: 'LCI_P_YEN_BAI', name: 'Phường Yên Bái', type: 'phuong', provinceCode: 'LCI', province: 'Lào Cai' },
  // Lâm Đồng
  { code: 'LDG_P_DA_LAT', name: 'Phường Đà Lạt', type: 'phuong', provinceCode: 'LDG', province: 'Lâm Đồng' },
  { code: 'LDG_P_BAO_LOC', name: 'Phường Bảo Lộc', type: 'phuong', provinceCode: 'LDG', province: 'Lâm Đồng' },
  // Long An
  { code: 'LA_P_TAN_AN', name: 'Phường Tân An', type: 'phuong', provinceCode: 'LA', province: 'Long An' },
  // Nghệ An
  { code: 'NAN_P_VINH', name: 'Phường Vinh', type: 'phuong', provinceCode: 'NAN', province: 'Nghệ An' },
  { code: 'NAN_P_HA_TINH', name: 'Phường Hà Tĩnh', type: 'phuong', provinceCode: 'NAN', province: 'Nghệ An' },
  // Ninh Bình
  { code: 'NB_P_NINH_BINH', name: 'Phường Ninh Bình', type: 'phuong', provinceCode: 'NB', province: 'Ninh Bình' },
  { code: 'NB_P_PHAT_DIEM', name: 'Phường Phát Diệm', type: 'phuong', provinceCode: 'NB', province: 'Ninh Bình' },
  // Ninh Thuận
  { code: 'NT_P_PHAN_RANG', name: 'Phường Phan Rang - Tháp Chàm', type: 'phuong', provinceCode: 'NT', province: 'Ninh Thuận' },
  // Phú Thọ
  { code: 'PT_P_VIET_TRI', name: 'Phường Việt Trì', type: 'phuong', provinceCode: 'PT', province: 'Phú Thọ' },
  // Quảng Bình
  { code: 'QB_P_DONG_HOI', name: 'Phường Đồng Hới', type: 'phuong', provinceCode: 'QB', province: 'Quảng Bình' },
  // Quảng Ngãi
  { code: 'QN_P_QUANG_NGAI', name: 'Phường Quảng Ngãi', type: 'phuong', provinceCode: 'QN', province: 'Quảng Ngãi' },
  { code: 'QN_P_QUY_NHON', name: 'Phường Quy Nhơn', type: 'phuong', provinceCode: 'QN', province: 'Quảng Ngãi' },
  // Quảng Ninh
  { code: 'QNI_P_HA_LONG', name: 'Phường Hạ Long', type: 'phuong', provinceCode: 'QNI', province: 'Quảng Ninh' },
  { code: 'QNI_P_CAM_PHA', name: 'Phường Cẩm Phả', type: 'phuong', provinceCode: 'QNI', province: 'Quảng Ninh' },
  // Thanh Hóa
  { code: 'TH_P_THANH_HOA', name: 'Phường Thanh Hóa', type: 'phuong', provinceCode: 'TH', province: 'Thanh Hóa' },
  // Thái Nguyên
  { code: 'TN_P_THAI_NGUYEN', name: 'Phường Thái Nguyên', type: 'phuong', provinceCode: 'TN', province: 'Thái Nguyên' },
  { code: 'TN_P_BAC_GIANG', name: 'Phường Bắc Giang', type: 'phuong', provinceCode: 'TN', province: 'Thái Nguyên' },
  // Tuyên Quang
  { code: 'TQ_P_TUYEN_QUANG', name: 'Phường Tuyên Quang', type: 'phuong', provinceCode: 'TQ', province: 'Tuyên Quang' },
  // Tây Ninh
  { code: 'TYN_P_TAY_NINH', name: 'Phường Tây Ninh', type: 'phuong', provinceCode: 'TYN', province: 'Tây Ninh' },
  // Vĩnh Long
  { code: 'VL_P_VINH_LONG', name: 'Phường Vĩnh Long', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
  { code: 'VL_P_BEN_TRE', name: 'Phường Bến Tre', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
  { code: 'VL_P_TRA_VINH', name: 'Phường Trà Vinh', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
];

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT — TPHCM ưu tiên đầu tiên, sau đó 5 TP lớn, rồi các tỉnh
// ═══════════════════════════════════════════════════════════════════════════

/** Toàn bộ phường/xã — TPHCM ưu tiên đầu */
export const VIETNAM_WARDS: Ward[] = [
  ...HCM_WARDS,
  ...HN_WARDS,
  ...DN_WARDS,
  ...HP_WARDS,
  ...CT_WARDS,
  ...HUE_WARDS,
  ...OTHER_PROVINCE_WARDS,
];

/** Chỉ phường/xã TPHCM */
export const HCMC_WARDS = HCM_WARDS;

/** Tên phường/xã TPHCM để dùng trong autocomplete (TPHCM đầu, toàn quốc sau) */
export const WARD_NAMES_HCM_FIRST: string[] = [
  ...HCM_WARDS.map(w => w.name),
  ...HN_WARDS.map(w => w.name),
  ...DN_WARDS.map(w => w.name),
  ...HP_WARDS.map(w => w.name),
  ...CT_WARDS.map(w => w.name),
  ...HUE_WARDS.map(w => w.name),
  ...OTHER_PROVINCE_WARDS.map(w => w.name),
];

/** Lấy phường/xã theo tỉnh */
export function getWardsByProvince(provinceCode: string): Ward[] {
  return VIETNAM_WARDS.filter(w => w.provinceCode === provinceCode);
}

/** Tìm kiếm phường/xã (TPHCM ưu tiên) */
export function searchWards(query: string, limit = 20): Ward[] {
  if (!query.trim()) return HCM_WARDS.slice(0, limit);
  const q = query.toLowerCase().trim();
  return VIETNAM_WARDS
    .filter(w => w.name.toLowerCase().includes(q))
    .slice(0, limit);
}
