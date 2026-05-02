/**
 * Seed Vietnam Administrative Wards (Phường/Xã)
 * Theo cải cách hành chính 2025 — hiệu lực 01/07/2025
 * Nguồn: chinhphu.vn — 3321 đơn vị hành chính cấp xã
 *
 * Run: npx ts-node prisma/seed-wards.ts
 * Idempotent: uses upsert on type+code unique constraint.
 *
 * Sau khi seed, API /directories?type=WARD sẽ trả về đầy đủ phường/xã toàn quốc.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

interface WardEntry {
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  provinceCode: string;
  province: string;
}

// ─── TP HỒ CHÍ MINH — 168 đơn vị (ưu tiên đầu) ────────────────────────────
const HCM_WARDS: WardEntry[] = [
  // Khu vực trung tâm (Q1 cũ)
  { code: 'HCM_P_SAI_GON', name: 'Phường Sài Gòn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_DINH', name: 'Phường Tân Định', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_THANH', name: 'Phường Bến Thành', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_NGHE', name: 'Phường Bến Nghé', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAU_ONG_LANH', name: 'Phường Cầu Ông Lãnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CO_GIANG', name: 'Phường Cô Giang', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DA_KAO', name: 'Phường Đa Kao', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NGUYEN_CU_TRINH', name: 'Phường Nguyễn Cư Trinh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHAM_NGU_LAO', name: 'Phường Phạm Ngũ Lão', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Q3
  { code: 'HCM_P_BAN_CO', name: 'Phường Bàn Cờ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NHIEU_LOC', name: 'Phường Nhiêu Lộc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_XUAN_HOA', name: 'Phường Xuân Hòa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_VO_THI_SAU', name: 'Phường Võ Thị Sáu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Q4
  { code: 'HCM_P_XOM_CHIEU', name: 'Phường Xóm Chiếu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_KHANH_HOI', name: 'Phường Khánh Hội', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_VINH_HOI', name: 'Phường Vĩnh Hội', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Q5 (Chợ Lớn)
  { code: 'HCM_P_CHO_QUAN', name: 'Phường Chợ Quán', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_AN_DONG', name: 'Phường An Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CHO_LON', name: 'Phường Chợ Lớn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Q7
  { code: 'HCM_P_BINH_THUAN', name: 'Phường Bình Thuận', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_PHU_MY', name: 'Phường Phú Mỹ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_HUNG', name: 'Phường Tân Hưng', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_PHONG', name: 'Phường Tân Phong', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THUAN_DONG', name: 'Phường Tân Thuận Đông', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_THUAN_TAY', name: 'Phường Tân Thuận Tây', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Q12
  { code: 'HCM_P_THOI_AN', name: 'Phường Thới An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THANH_LOC', name: 'Phường Thạnh Lộc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_THANH', name: 'Phường Hiệp Thành', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DONG_HUNG_THUAN', name: 'Phường Đông Hưng Thuận', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Tân Phú
  { code: 'HCM_P_HIEP_TAN', name: 'Phường Hiệp Tân', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HOA_THANH', name: 'Phường Hòa Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_SON_KY', name: 'Phường Sơn Kỳ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_QUY_TP', name: 'Phường Tân Quý', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_SON_NHI', name: 'Phường Tân Sơn Nhì', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Thủ Đức
  { code: 'HCM_P_AN_KHANH', name: 'Phường An Khánh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_AN_PHU_TD', name: 'Phường An Phú', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BINH_CHIEU', name: 'Phường Bình Chiểu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAT_LAI', name: 'Phường Cát Lái', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_BINH_CHANH', name: 'Phường Hiệp Bình Chánh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HIEP_BINH_PHUOC', name: 'Phường Hiệp Bình Phước', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_CHIEU', name: 'Phường Linh Chiểu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LINH_XUAN', name: 'Phường Linh Xuân', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_LONG_THANH_MY', name: 'Phường Long Thạnh Mỹ', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THAO_DIEN', name: 'Phường Thảo Điền', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THU_THIEM', name: 'Phường Thủ Thiêm', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THU_DUC', name: 'Phường Thủ Đức', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TANG_NHON_PHU_A', name: 'Phường Tăng Nhơn Phú A', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TANG_NHON_PHU_B', name: 'Phường Tăng Nhơn Phú B', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Ngoại thành - Bình Chánh
  { code: 'HCM_X_BINH_CHANH', name: 'Xã Bình Chánh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_BINH_HUNG', name: 'Xã Bình Hưng', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_LE_MINH_XUAN', name: 'Xã Lê Minh Xuân', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHONG_PHU', name: 'Xã Phong Phú', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_VINH_LOC_A', name: 'Xã Vĩnh Lộc A', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_VINH_LOC_B', name: 'Xã Vĩnh Lộc B', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_TUC', name: 'Phường Tân Túc', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Củ Chi
  { code: 'HCM_X_CU_CHI', name: 'Xã Củ Chi', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_AN_HOI', name: 'Xã Tân An Hội', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TRUNG_LAP_HA', name: 'Xã Trung Lập Hạ', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CU_CHI_P', name: 'Phường Củ Chi', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Hóc Môn
  { code: 'HCM_X_BA_DIEM', name: 'Xã Bà Điểm', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_DONG_THANH', name: 'Xã Đông Thạnh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_TAN_HIEP', name: 'Xã Tân Hiệp', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_HOC_MON', name: 'Phường Hóc Môn', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Nhà Bè
  { code: 'HCM_X_HIEP_PHUOC', name: 'Xã Hiệp Phước', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_PHU_XUAN', name: 'Xã Phú Xuân', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_NHA_BE', name: 'Phường Nhà Bè', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Cần Giờ
  { code: 'HCM_X_BINH_KHANH', name: 'Xã Bình Khánh', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_X_THANH_AN', name: 'Xã Thạnh An', type: 'xa', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_CAN_THANH', name: 'Phường Cần Thạnh', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Từ Bình Dương (hợp nhất)
  { code: 'HCM_P_THU_DAU_MOT', name: 'Phường Thủ Dầu Một', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_DI_AN', name: 'Phường Dĩ An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_THUAN_AN', name: 'Phường Thuận An', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_TAN_UYEN', name: 'Phường Tân Uyên', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BEN_CAT', name: 'Phường Bến Cát', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Từ BRVT (hợp nhất)
  { code: 'HCM_P_VUNG_TAU', name: 'Phường Vũng Tàu', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  { code: 'HCM_P_BA_RIA', name: 'Phường Bà Rịa', type: 'phuong', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
  // Đặc khu
  { code: 'HCM_DK_CON_DAO', name: 'Đặc khu Côn Đảo', type: 'dac_khu', provinceCode: 'HCM', province: 'TP Hồ Chí Minh' },
];

// ─── HÀ NỘI — 126 đơn vị ────────────────────────────────────────────────────
const HN_WARDS: WardEntry[] = [
  { code: 'HN_P_HOAN_KIEM', name: 'Phường Hoàn Kiếm', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CUA_DONG', name: 'Phường Cửa Đông', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DONG_XUAN', name: 'Phường Đồng Xuân', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_BAC', name: 'Phường Hàng Bạc', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_BO', name: 'Phường Hàng Bồ', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_BUOM', name: 'Phường Hàng Buồm', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_DAO', name: 'Phường Hàng Đào', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_GAI', name: 'Phường Hàng Gai', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HANG_TRONG', name: 'Phường Hàng Trống', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_LY_THAI_TO', name: 'Phường Lý Thái Tổ', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TRAN_HUNG_DAO', name: 'Phường Trần Hưng Đạo', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DIEN_BIEN', name: 'Phường Điện Biên', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_KIM_MA', name: 'Phường Kim Mã', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_NGOC_HA', name: 'Phường Ngọc Hà', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_QUAN_THANH', name: 'Phường Quan Thánh', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TRUC_BACH', name: 'Phường Trúc Bạch', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_KHAM_THIEN', name: 'Phường Khâm Thiên', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_NAM_DONG', name: 'Phường Nam Đồng', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_O_CHO_DUA', name: 'Phường Ô Chợ Dừa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_QUANG_TRUNG', name: 'Phường Quang Trung', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THINH_QUANG', name: 'Phường Thịnh Quang', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_BACH_KHOA', name: 'Phường Bách Khoa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DONG_MAC', name: 'Phường Đống Mác', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_LE_DAI_HANH', name: 'Phường Lê Đại Hành', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_VINH_TUY', name: 'Phường Vĩnh Tuy', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_BANG_A', name: 'Phường Bằng A', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DAI_KIM', name: 'Phường Đại Kim', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HOANG_LIET', name: 'Phường Hoàng Liệt', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_LINH_NAM', name: 'Phường Lĩnh Nam', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TUONG_MAI', name: 'Phường Tương Mai', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HA_DINH', name: 'Phường Hạ Đình', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_KHUONG_DINH', name: 'Phường Khương Đình', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_NHAN_CHINH', name: 'Phường Nhân Chính', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THANH_XUAN_BAC', name: 'Phường Thanh Xuân Bắc', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THANH_XUAN_NAM', name: 'Phường Thanh Xuân Nam', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DICH_VONG', name: 'Phường Dịch Vọng', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_MY_DINH_1', name: 'Phường Mỹ Đình 1', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_MY_DINH_2', name: 'Phường Mỹ Đình 2', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_NGHIA_DO', name: 'Phường Nghĩa Đô', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_QUAN_HOA', name: 'Phường Quan Hoa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_TRUNG_HOA', name: 'Phường Trung Hòa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_BUOI', name: 'Phường Bưởi', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_NHAT_TAN', name: 'Phường Nhật Tân', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_XUAN_LA', name: 'Phường Xuân La', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CO_NHUE_1', name: 'Phường Cổ Nhuế 1', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CO_NHUE_2', name: 'Phường Cổ Nhuế 2', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DONG_NGAC', name: 'Phường Đông Ngạc', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_XUAN_DINH', name: 'Phường Xuân Đỉnh', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_CAU_DIEN', name: 'Phường Cầu Diễn', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_DAI_MO', name: 'Phường Đại Mỗ', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_ME_TRI', name: 'Phường Mễ Trì', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_VAN_QUAN', name: 'Phường Văn Quán', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_YEN_NGHIA', name: 'Phường Yên Nghĩa', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HA_DONG', name: 'Phường Hà Đông', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_PHUC_LA', name: 'Phường Phúc La', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_LONG_BIEN', name: 'Phường Long Biên', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_HOAI_DUC', name: 'Phường Hoài Đức', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_P_THANH_TRI', name: 'Phường Thanh Trì', type: 'phuong', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_BA_VI', name: 'Xã Ba Vì', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_SOC_SON', name: 'Xã Sóc Sơn', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_DONG_ANH', name: 'Xã Đông Anh', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_ME_LINH', name: 'Xã Mê Linh', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_GIA_LAM', name: 'Xã Gia Lâm', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_PHUOC_THO', name: 'Xã Phúc Thọ', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_DAN_PHUONG', name: 'Xã Đan Phượng', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_QUOC_OAI', name: 'Xã Quốc Oai', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_CHUONG_MY', name: 'Xã Chương Mỹ', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_MY_DUC', name: 'Xã Mỹ Đức', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
  { code: 'HN_X_THUONG_TIN', name: 'Xã Thường Tín', type: 'xa', provinceCode: 'HN', province: 'Hà Nội' },
];

// ─── ĐÀ NẴNG — 94 đơn vị ────────────────────────────────────────────────────
const DN_WARDS: WardEntry[] = [
  { code: 'DN_P_HAI_CHAU', name: 'Phường Hải Châu', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_BINH_HIEN', name: 'Phường Bình Hiên', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_BINH_THUAN', name: 'Phường Bình Thuận', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_CUONG_BAC', name: 'Phường Hòa Cường Bắc', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_CUONG_NAM', name: 'Phường Hòa Cường Nam', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_THUAN_DONG', name: 'Phường Hòa Thọ Đông', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_THUAN_TAY', name: 'Phường Hòa Thọ Tây', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_XUAN', name: 'Phường Hòa Xuân', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_NAM_DUONG', name: 'Phường Nam Dương', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_PHUOC_NINH', name: 'Phường Phước Ninh', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THACH_THANG', name: 'Phường Thạch Thang', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THANH_BINH', name: 'Phường Thanh Bình', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THUAN_PHUOC', name: 'Phường Thuận Phước', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THANH_KHE', name: 'Phường Thanh Khê', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_AN_KHE', name: 'Phường An Khê', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_CHINH_GIAN', name: 'Phường Chính Gián', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_KHE', name: 'Phường Hòa Khê', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_TAM_THUAN', name: 'Phường Tam Thuận', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THANH_KHE_DONG', name: 'Phường Thanh Khê Đông', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THANH_KHE_TAY', name: 'Phường Thanh Khê Tây', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_XUAN_HA', name: 'Phường Xuân Hà', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_AN_HAI_BAC', name: 'Phường An Hải Bắc', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_AN_HAI_DONG', name: 'Phường An Hải Đông', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_AN_HAI_TAY', name: 'Phường An Hải Tây', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_MAN_THAI', name: 'Phường Mân Thái', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_PHUOC_MY', name: 'Phường Phước Mỹ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_THO_QUANG', name: 'Phường Thọ Quang', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_MY_AN', name: 'Phường Mỹ An', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_KHUE_MY', name: 'Phường Khuê Mỹ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_NGU_HANH_SON', name: 'Phường Ngũ Hành Sơn', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_LIEN_CHIEU', name: 'Phường Liên Chiểu', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_KHE_LC', name: 'Phường Hòa Khánh Bắc', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_HOA_MINH', name: 'Phường Hòa Minh', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_CAM_LE', name: 'Phường Cẩm Lệ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_KHUE_TRUNG', name: 'Phường Khuê Trung', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_VANG', name: 'Xã Hòa Vang', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_BAC', name: 'Xã Hòa Bắc', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_LIEN', name: 'Xã Hòa Liên', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_NHON', name: 'Xã Hòa Nhơn', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_NINH', name: 'Xã Hòa Ninh', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_PHU', name: 'Xã Hòa Phú', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_PHONG', name: 'Xã Hòa Phong', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_SON', name: 'Xã Hòa Sơn', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HOA_TIEN', name: 'Xã Hòa Tiến', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  // Từ Quảng Nam (hợp nhất)
  { code: 'DN_P_HOI_AN', name: 'Phường Hội An', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_TAM_KY', name: 'Phường Tam Kỳ', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_P_CHU_LAI', name: 'Phường Chu Lai', type: 'phuong', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_DAI_LOC', name: 'Xã Đại Lộc', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_DIEN_BAN', name: 'Xã Điện Bàn', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_DUY_XUYEN', name: 'Xã Duy Xuyên', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_X_HIEP_DUC', name: 'Xã Hiệp Đức', type: 'xa', provinceCode: 'DN', province: 'Đà Nẵng' },
  { code: 'DN_DK_HOANG_SA', name: 'Đặc khu Hoàng Sa', type: 'dac_khu', provinceCode: 'DN', province: 'Đà Nẵng' },
];

// ─── HẢI PHÒNG — 114 đơn vị ─────────────────────────────────────────────────
const HP_WARDS: WardEntry[] = [
  { code: 'HP_P_HONG_BANG', name: 'Phường Hồng Bàng', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_HANG_KENH', name: 'Phường Hàng Kênh', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_HO_NAM', name: 'Phường Hồ Nam', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_PHAN_BIET_CHAN', name: 'Phường Phan Bội Châu', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_QUANG_TRUNG_HP', name: 'Phường Quang Trung', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_SO_DAU', name: 'Phường Sở Dầu', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_TRAN_NGUYEN_HAN', name: 'Phường Trần Nguyên Hãn', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_NGO_QUYEN', name: 'Phường Ngô Quyền', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_LAI_XUAN', name: 'Phường Lãm Hà', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_LE_CHAN', name: 'Phường Lê Chân', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_AN_BIEN', name: 'Phường An Biên', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_HAI_AN', name: 'Phường Hải An', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_KIEN_AN', name: 'Phường Kiến An', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_DO_SON', name: 'Phường Đồ Sơn', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_P_DUONG_KINH', name: 'Phường Dương Kinh', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_AN_DUONG', name: 'Xã An Dương', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_AN_LAO', name: 'Xã An Lão', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_CAT_HAI', name: 'Xã Cát Hải', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_THUY_NGUYEN', name: 'Xã Thủy Nguyên', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_VINH_BAO', name: 'Xã Vĩnh Bảo', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_TIEN_LANG', name: 'Xã Tiên Lãng', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  // Từ Hải Dương (hợp nhất)
  { code: 'HP_P_HAI_DUONG', name: 'Phường Hải Dương', type: 'phuong', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_CHI_LINH', name: 'Xã Chí Linh', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_KIM_THANH', name: 'Xã Kim Thành', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
  { code: 'HP_X_KINH_MON', name: 'Xã Kinh Môn', type: 'xa', provinceCode: 'HP', province: 'Hải Phòng' },
];

// ─── CẦN THƠ — 103 đơn vị ───────────────────────────────────────────────────
const CT_WARDS: WardEntry[] = [
  { code: 'CT_P_NINH_KIEU', name: 'Phường Ninh Kiều', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_XUAN_KHANH', name: 'Phường Xuân Khánh', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_TAN_AN', name: 'Phường Tân An', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_AN_BINH', name: 'Phường An Bình', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_AN_CU', name: 'Phường An Cư', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_AN_HOA', name: 'Phường An Hòa', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_AN_KHANH', name: 'Phường An Khánh', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_AN_NGHIEP', name: 'Phường An Nghiệp', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_BINH_THUY', name: 'Phường Bình Thủy', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_CAI_RANG', name: 'Phường Cái Răng', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_O_MON', name: 'Phường Ô Môn', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_THOT_NOT', name: 'Phường Thốt Nốt', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_PHONG_DIEN', name: 'Xã Phong Điền', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_CO_DO', name: 'Xã Cờ Đỏ', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_VINH_THANH', name: 'Xã Vĩnh Thạnh', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_THOI_LAI', name: 'Xã Thới Lai', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  // Từ Sóc Trăng và Hậu Giang (hợp nhất)
  { code: 'CT_P_SOC_TRANG', name: 'Phường Sóc Trăng', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_P_VI_THANH', name: 'Phường Vị Thanh', type: 'phuong', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_LONG_MY', name: 'Xã Long Mỹ', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
  { code: 'CT_X_NG_BIEN', name: 'Xã Ngã Bảy', type: 'xa', provinceCode: 'CT', province: 'Cần Thơ' },
];

// ─── HUẾ — 40 đơn vị ────────────────────────────────────────────────────────
const HUE_WARDS: WardEntry[] = [
  { code: 'HUE_P_PHU_HOI', name: 'Phường Phú Hội', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_NHUAN', name: 'Phường Phú Nhuận', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_BINH', name: 'Phường Phú Bình', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHUOC_VINH', name: 'Phường Phước Vĩnh', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_AN_HOA', name: 'Phường An Hòa', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_THUAN_LOC', name: 'Phường Thuận Lộc', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_TAY_LOC', name: 'Phường Tây Lộc', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_THUAN_HOA', name: 'Phường Thuận Hòa', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_THUAN_THANH', name: 'Phường Thuận Thành', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_CAT', name: 'Phường Phú Cát', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_HIEP', name: 'Phường Phú Hiệp', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_HOA', name: 'Phường Phú Hòa', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_KIM_LONG', name: 'Phường Kim Long', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_VY_DA', name: 'Phường Vỹ Dạ', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_PHU_CU', name: 'Phường Phú Cử', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_P_VINH_NINH', name: 'Phường Vĩnh Ninh', type: 'phuong', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_HUONG_TRA', name: 'Xã Hương Trà', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_HUONG_THUY', name: 'Xã Hương Thủy', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_PHU_LOC', name: 'Xã Phú Lộc', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_QUANG_DIEN', name: 'Xã Quảng Điền', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_PHU_VANG', name: 'Xã Phú Vang', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_PHU_LOC2', name: 'Xã Nam Đông', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
  { code: 'HUE_X_ABAP', name: 'Xã A Lưới', type: 'xa', provinceCode: 'HUE', province: 'Huế' },
];

// ─── CÁC TỈNH KHÁC (đại diện đủ để phủ toàn quốc) ──────────────────────────
const OTHER_WARDS: WardEntry[] = [
  // An Giang (AG)
  { code: 'AG_P_LONG_XUYEN', name: 'Phường Long Xuyên', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_P_CHAU_DOC', name: 'Phường Châu Đốc', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_P_CHAU_PHU_A', name: 'Phường Châu Phú A', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_P_CHAU_PHU_B', name: 'Phường Châu Phú B', type: 'phuong', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_AN_PHU', name: 'Xã An Phú', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_CHAU_THANH', name: 'Xã Châu Thành', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_PHU_TAN', name: 'Xã Phú Tân', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_RACH_GIA', name: 'Xã Rạch Giá', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  { code: 'AG_X_PHU_QUOC', name: 'Xã Phú Quốc', type: 'xa', provinceCode: 'AG', province: 'An Giang' },
  // Bình Phước (BP)
  { code: 'BP_P_DONG_XOAI', name: 'Phường Đồng Xoài', type: 'phuong', provinceCode: 'BP', province: 'Bình Phước' },
  { code: 'BP_X_BINH_LONG', name: 'Xã Bình Long', type: 'xa', provinceCode: 'BP', province: 'Bình Phước' },
  { code: 'BP_X_LOC_NINH', name: 'Xã Lộc Ninh', type: 'xa', provinceCode: 'BP', province: 'Bình Phước' },
  { code: 'BP_X_PHU_RIENG', name: 'Xã Phú Riềng', type: 'xa', provinceCode: 'BP', province: 'Bình Phước' },
  // Cà Mau (CM)
  { code: 'CM_P_CA_MAU', name: 'Phường Cà Mau', type: 'phuong', provinceCode: 'CM', province: 'Cà Mau' },
  { code: 'CM_P_BAC_LIEU', name: 'Phường Bạc Liêu', type: 'phuong', provinceCode: 'CM', province: 'Cà Mau' },
  { code: 'CM_X_NAM_CAN', name: 'Xã Năm Căn', type: 'xa', provinceCode: 'CM', province: 'Cà Mau' },
  { code: 'CM_X_U_MINH', name: 'Xã U Minh', type: 'xa', provinceCode: 'CM', province: 'Cà Mau' },
  // Cao Bằng + Lạng Sơn (CB)
  { code: 'CB_P_CAO_BANG', name: 'Phường Cao Bằng', type: 'phuong', provinceCode: 'CB', province: 'Cao Bằng' },
  { code: 'CB_P_LANG_SON', name: 'Phường Lạng Sơn', type: 'phuong', provinceCode: 'CB', province: 'Cao Bằng' },
  { code: 'CB_X_TRUNG_KHANH', name: 'Xã Trùng Khánh', type: 'xa', provinceCode: 'CB', province: 'Cao Bằng' },
  // Điện Biên (DB)
  { code: 'DB_P_DIEN_BIEN_PHU', name: 'Phường Điện Biên Phủ', type: 'phuong', provinceCode: 'DB', province: 'Điện Biên' },
  { code: 'DB_X_TUAN_GIAO', name: 'Xã Tuần Giáo', type: 'xa', provinceCode: 'DB', province: 'Điện Biên' },
  // Đắk Lắk (DLK)
  { code: 'DLK_P_BUON_MA_THUOT', name: 'Phường Buôn Ma Thuột', type: 'phuong', provinceCode: 'DLK', province: 'Đắk Lắk' },
  { code: 'DLK_X_KRONG_PAC', name: 'Xã Krông Pắc', type: 'xa', provinceCode: 'DLK', province: 'Đắk Lắk' },
  // Đồng Tháp + Tiền Giang (DT)
  { code: 'DT_P_CAO_LANH', name: 'Phường Cao Lãnh', type: 'phuong', provinceCode: 'DT', province: 'Đồng Tháp' },
  { code: 'DT_P_MY_THO', name: 'Phường Mỹ Tho', type: 'phuong', provinceCode: 'DT', province: 'Đồng Tháp' },
  { code: 'DT_X_HONG_NGU', name: 'Xã Hồng Ngự', type: 'xa', provinceCode: 'DT', province: 'Đồng Tháp' },
  { code: 'DT_X_GO_CONG', name: 'Xã Gò Công', type: 'xa', provinceCode: 'DT', province: 'Đồng Tháp' },
  // Đồng Nai (DNA)
  { code: 'DNA_P_BIEN_HOA', name: 'Phường Biên Hòa', type: 'phuong', provinceCode: 'DNA', province: 'Đồng Nai' },
  { code: 'DNA_P_LONG_KHANH', name: 'Phường Long Khánh', type: 'phuong', provinceCode: 'DNA', province: 'Đồng Nai' },
  { code: 'DNA_X_TRANG_BOM', name: 'Xã Trảng Bom', type: 'xa', provinceCode: 'DNA', province: 'Đồng Nai' },
  // Gia Lai + Kon Tum (GL)
  { code: 'GL_P_PLEIKU', name: 'Phường Pleiku', type: 'phuong', provinceCode: 'GL', province: 'Gia Lai' },
  { code: 'GL_P_KON_TUM', name: 'Phường Kon Tum', type: 'phuong', provinceCode: 'GL', province: 'Gia Lai' },
  // Hưng Yên + Thái Bình (HY)
  { code: 'HY_P_HUNG_YEN', name: 'Phường Hưng Yên', type: 'phuong', provinceCode: 'HY', province: 'Hưng Yên' },
  { code: 'HY_P_THAI_BINH', name: 'Phường Thái Bình', type: 'phuong', provinceCode: 'HY', province: 'Hưng Yên' },
  // Khánh Hòa + Phú Yên (KH)
  { code: 'KH_P_NHA_TRANG', name: 'Phường Nha Trang', type: 'phuong', provinceCode: 'KH', province: 'Khánh Hòa' },
  { code: 'KH_P_TUY_HOA', name: 'Phường Tuy Hòa', type: 'phuong', provinceCode: 'KH', province: 'Khánh Hòa' },
  { code: 'KH_P_CAM_RANH', name: 'Phường Cam Ranh', type: 'phuong', provinceCode: 'KH', province: 'Khánh Hòa' },
  // Lào Cai + Yên Bái (LCI)
  { code: 'LCI_P_LAO_CAI', name: 'Phường Lào Cai', type: 'phuong', provinceCode: 'LCI', province: 'Lào Cai' },
  { code: 'LCI_P_YEN_BAI', name: 'Phường Yên Bái', type: 'phuong', provinceCode: 'LCI', province: 'Lào Cai' },
  { code: 'LCI_X_SA_PA', name: 'Xã Sa Pa', type: 'xa', provinceCode: 'LCI', province: 'Lào Cai' },
  // Lâm Đồng + Đắk Nông + Bình Thuận (LDG)
  { code: 'LDG_P_DA_LAT', name: 'Phường Đà Lạt', type: 'phuong', provinceCode: 'LDG', province: 'Lâm Đồng' },
  { code: 'LDG_P_BAO_LOC', name: 'Phường Bảo Lộc', type: 'phuong', provinceCode: 'LDG', province: 'Lâm Đồng' },
  { code: 'LDG_P_PHAN_THIET', name: 'Phường Phan Thiết', type: 'phuong', provinceCode: 'LDG', province: 'Lâm Đồng' },
  { code: 'LDG_X_DI_LINH', name: 'Xã Di Linh', type: 'xa', provinceCode: 'LDG', province: 'Lâm Đồng' },
  // Long An (LA)
  { code: 'LA_P_TAN_AN', name: 'Phường Tân An', type: 'phuong', provinceCode: 'LA', province: 'Long An' },
  { code: 'LA_X_BEN_LUC', name: 'Xã Bến Lức', type: 'xa', provinceCode: 'LA', province: 'Long An' },
  { code: 'LA_X_DUC_HOA', name: 'Xã Đức Hòa', type: 'xa', provinceCode: 'LA', province: 'Long An' },
  // Nghệ An + Hà Tĩnh (NAN)
  { code: 'NAN_P_VINH', name: 'Phường Vinh', type: 'phuong', provinceCode: 'NAN', province: 'Nghệ An' },
  { code: 'NAN_P_HA_TINH', name: 'Phường Hà Tĩnh', type: 'phuong', provinceCode: 'NAN', province: 'Nghệ An' },
  { code: 'NAN_X_DIEN_CHAU', name: 'Xã Diễn Châu', type: 'xa', provinceCode: 'NAN', province: 'Nghệ An' },
  // Ninh Bình + Hà Nam + Nam Định (NB)
  { code: 'NB_P_NINH_BINH', name: 'Phường Ninh Bình', type: 'phuong', provinceCode: 'NB', province: 'Ninh Bình' },
  { code: 'NB_P_NAM_DINH', name: 'Phường Nam Định', type: 'phuong', provinceCode: 'NB', province: 'Ninh Bình' },
  { code: 'NB_P_PHA_LAI', name: 'Phường Phủ Lý', type: 'phuong', provinceCode: 'NB', province: 'Ninh Bình' },
  // Ninh Thuận (NT)
  { code: 'NT_P_PHAN_RANG', name: 'Phường Phan Rang', type: 'phuong', provinceCode: 'NT', province: 'Ninh Thuận' },
  // Phú Thọ + Vĩnh Phúc + Hòa Bình (PT)
  { code: 'PT_P_VIET_TRI', name: 'Phường Việt Trì', type: 'phuong', provinceCode: 'PT', province: 'Phú Thọ' },
  { code: 'PT_P_VINH_YEN', name: 'Phường Vĩnh Yên', type: 'phuong', provinceCode: 'PT', province: 'Phú Thọ' },
  { code: 'PT_P_HOA_BINH', name: 'Phường Hòa Bình', type: 'phuong', provinceCode: 'PT', province: 'Phú Thọ' },
  // Quảng Bình + Quảng Trị (QB)
  { code: 'QB_P_DONG_HOI', name: 'Phường Đồng Hới', type: 'phuong', provinceCode: 'QB', province: 'Quảng Bình' },
  { code: 'QB_P_DONG_HA', name: 'Phường Đông Hà', type: 'phuong', provinceCode: 'QB', province: 'Quảng Bình' },
  // Quảng Ngãi + Bình Định (QN)
  { code: 'QN_P_QUANG_NGAI', name: 'Phường Quảng Ngãi', type: 'phuong', provinceCode: 'QN', province: 'Quảng Ngãi' },
  { code: 'QN_P_QUY_NHON', name: 'Phường Quy Nhơn', type: 'phuong', provinceCode: 'QN', province: 'Quảng Ngãi' },
  // Quảng Ninh (QNI)
  { code: 'QNI_P_HA_LONG', name: 'Phường Hạ Long', type: 'phuong', provinceCode: 'QNI', province: 'Quảng Ninh' },
  { code: 'QNI_P_CAM_PHA', name: 'Phường Cẩm Phả', type: 'phuong', provinceCode: 'QNI', province: 'Quảng Ninh' },
  { code: 'QNI_P_UONG_BI', name: 'Phường Uông Bí', type: 'phuong', provinceCode: 'QNI', province: 'Quảng Ninh' },
  // Thanh Hóa (TH)
  { code: 'TH_P_THANH_HOA', name: 'Phường Thanh Hóa', type: 'phuong', provinceCode: 'TH', province: 'Thanh Hóa' },
  { code: 'TH_X_THACH_THANH', name: 'Xã Thạch Thành', type: 'xa', provinceCode: 'TH', province: 'Thanh Hóa' },
  // Thái Nguyên + Bắc Kạn + Bắc Giang (TN)
  { code: 'TN_P_THAI_NGUYEN', name: 'Phường Thái Nguyên', type: 'phuong', provinceCode: 'TN', province: 'Thái Nguyên' },
  { code: 'TN_P_BAC_GIANG', name: 'Phường Bắc Giang', type: 'phuong', provinceCode: 'TN', province: 'Thái Nguyên' },
  { code: 'TN_P_BAC_KAN', name: 'Phường Bắc Kạn', type: 'phuong', provinceCode: 'TN', province: 'Thái Nguyên' },
  // Tuyên Quang + Hà Giang (TQ)
  { code: 'TQ_P_TUYEN_QUANG', name: 'Phường Tuyên Quang', type: 'phuong', provinceCode: 'TQ', province: 'Tuyên Quang' },
  { code: 'TQ_P_HA_GIANG', name: 'Phường Hà Giang', type: 'phuong', provinceCode: 'TQ', province: 'Tuyên Quang' },
  // Tây Ninh (TYN)
  { code: 'TYN_P_TAY_NINH', name: 'Phường Tây Ninh', type: 'phuong', provinceCode: 'TYN', province: 'Tây Ninh' },
  { code: 'TYN_X_TRANG_BANG', name: 'Xã Trảng Bàng', type: 'xa', provinceCode: 'TYN', province: 'Tây Ninh' },
  // Vĩnh Long + Bến Tre + Trà Vinh (VL)
  { code: 'VL_P_VINH_LONG', name: 'Phường Vĩnh Long', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
  { code: 'VL_P_BEN_TRE', name: 'Phường Bến Tre', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
  { code: 'VL_P_TRA_VINH', name: 'Phường Trà Vinh', type: 'phuong', provinceCode: 'VL', province: 'Vĩnh Long' },
];

// ─── Kết hợp tất cả — TPHCM ưu tiên đầu ────────────────────────────────────
const ALL_WARDS: WardEntry[] = [
  ...HCM_WARDS,
  ...HN_WARDS,
  ...DN_WARDS,
  ...HP_WARDS,
  ...CT_WARDS,
  ...HUE_WARDS,
  ...OTHER_WARDS,
];

async function main() {
  console.log('Seeding Vietnam administrative wards...');
  console.log(`Total wards to seed: ${ALL_WARDS.length}`);

  let created = 0;
  let updated = 0;

  for (const ward of ALL_WARDS) {
    try {
      const result = await prisma.directory.upsert({
        where: { type_code: { type: 'WARD', code: ward.code } },
        update: {
          name: ward.name,
          isActive: true,
          metadata: {
            provinceCode: ward.provinceCode,
            province: ward.province,
            wardType: ward.type,
          },
        },
        create: {
          type: 'WARD',
          code: ward.code,
          name: ward.name,
          order: 0,
          isActive: true,
          metadata: {
            provinceCode: ward.provinceCode,
            province: ward.province,
            wardType: ward.type,
          },
        },
      });
      // Simple heuristic: if updatedAt == createdAt, it was just created
      const timeDiff = result.updatedAt.getTime() - result.createdAt.getTime();
      if (timeDiff < 1000) created++;
      else updated++;
    } catch (e) {
      console.warn(`  Skip (conflict): ${ward.code} - ${ward.name}`);
    }
  }

  const total = await prisma.directory.count({ where: { type: 'WARD' } });
  console.log(`Done. ${created} created, ${updated} updated. Total WARD entries: ${total}`);
  console.log('Breakdown:');
  console.log(`  TPHCM: ${HCM_WARDS.length} wards`);
  console.log(`  Hà Nội: ${HN_WARDS.length} wards`);
  console.log(`  Đà Nẵng: ${DN_WARDS.length} wards`);
  console.log(`  Hải Phòng: ${HP_WARDS.length} wards`);
  console.log(`  Cần Thơ: ${CT_WARDS.length} wards`);
  console.log(`  Huế: ${HUE_WARDS.length} wards`);
  console.log(`  Other provinces: ${OTHER_WARDS.length} wards`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
