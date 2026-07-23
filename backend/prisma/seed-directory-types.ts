/**
 * Seed Directory Types — all FK selects (PROVINCE, WARD-types, INCIDENT_TYPE, etc.)
 * Run standalone: npx ts-node prisma/seed-directory-types.ts
 * Or called from seed.ts via seedDirectoryTypes(prisma)
 * Idempotent: uses upsert on type+code unique constraint.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

interface DirectoryEntry {
  type: string;
  code: string;
  name: string;
  order: number;
}

export const DIRECTORY_DATA: DirectoryEntry[] = [
  // ── INCIDENT_TYPE (Loại vụ việc) ─────────────────────────────────────────
  { type: 'INCIDENT_TYPE', code: 'VPHC', name: 'Vi phạm hành chính', order: 1 },
  { type: 'INCIDENT_TYPE', code: 'TCDS', name: 'Tranh chấp dân sự', order: 2 },
  { type: 'INCIDENT_TYPE', code: 'ANTT', name: 'An ninh trật tự', order: 3 },
  { type: 'INCIDENT_TYPE', code: 'KHAC', name: 'Khác', order: 4 },

  // ── PETITION_TYPE (Loại đơn thư) ─────────────────────────────────────────
  { type: 'PETITION_TYPE', code: 'TC', name: 'Tố cáo', order: 1 },
  { type: 'PETITION_TYPE', code: 'KN', name: 'Khiếu nại', order: 2 },
  { type: 'PETITION_TYPE', code: 'KNG', name: 'Kiến nghị', order: 3 },
  { type: 'PETITION_TYPE', code: 'PA', name: 'Phản ánh', order: 4 },

  // ── DON_VI (Đơn vị — dùng cho "Đơn vị tiếp nhận" & "Đơn vị xử lý" đơn thư) ─
  { type: 'DON_VI', code: 'PC02', name: 'Phòng CSĐT - CA TP.HCM (PC02)', order: 1 },
  { type: 'DON_VI', code: 'PC01', name: 'Văn phòng CQ CSĐT (PC01)', order: 2 },
  { type: 'DON_VI', code: 'CAQ1', name: 'Công an Quận 1', order: 3 },
  { type: 'DON_VI', code: 'CAQ3', name: 'Công an Quận 3', order: 4 },
  { type: 'DON_VI', code: 'VKSTP', name: 'Viện kiểm sát nhân dân TP.HCM', order: 5 },

  // ── PRIORITY (Mức độ ưu tiên) ────────────────────────────────────────────
  { type: 'PRIORITY', code: 'CAO', name: 'Cao', order: 1 },
  { type: 'PRIORITY', code: 'TB', name: 'Trung bình', order: 2 },
  { type: 'PRIORITY', code: 'THAP', name: 'Thấp', order: 3 },

  // ── GENDER (Giới tính) ───────────────────────────────────────────────────
  { type: 'GENDER', code: 'NAM', name: 'Nam', order: 1 },
  { type: 'GENDER', code: 'NU', name: 'Nữ', order: 2 },
  { type: 'GENDER', code: 'KHAC', name: 'Khác', order: 3 },

  // ── AGE_GROUP (Nhóm tuổi) ────────────────────────────────────────────────
  { type: 'AGE_GROUP', code: 'U18', name: 'Dưới 18', order: 1 },
  { type: 'AGE_GROUP', code: '18-30', name: '18-30', order: 2 },
  { type: 'AGE_GROUP', code: '30-45', name: '30-45', order: 3 },
  { type: 'AGE_GROUP', code: '45-60', name: '45-60', order: 4 },
  { type: 'AGE_GROUP', code: 'O60', name: 'Trên 60', order: 5 },

  // ── EDUCATION_LEVEL (Trình độ học vấn) ───────────────────────────────────
  { type: 'EDUCATION_LEVEL', code: 'TH', name: 'Tiểu học', order: 1 },
  { type: 'EDUCATION_LEVEL', code: 'THCS', name: 'THCS', order: 2 },
  { type: 'EDUCATION_LEVEL', code: 'THPT', name: 'THPT', order: 3 },
  { type: 'EDUCATION_LEVEL', code: 'CD', name: 'Cao đẳng', order: 4 },
  { type: 'EDUCATION_LEVEL', code: 'DH', name: 'Đại học', order: 5 },
  { type: 'EDUCATION_LEVEL', code: 'SDH', name: 'Sau đại học', order: 6 },

  // ── DISTRICT (Quận/Huyện CŨ — đã bãi bỏ 01/7/2025) ───────────────────────
  // Subject.districtId là "legacy only": mô hình 2 cấp không còn quận/huyện, nhưng
  // hồ sơ 2016-2025 vẫn trỏ về đây nên danh mục PHẢI tồn tại thì màn hình mới hiện
  // đúng tên. Runner ở cuối file tự đặt isActive=false cho toàn bộ nhóm này.
  // 22 đơn vị lấy nguyên từ bảng chi_nhanh hệ cũ (loai_don_vi=5).
  { type: 'DISTRICT', code: 'Q1', name: 'Quận 1', order: 1 },
  { type: 'DISTRICT', code: 'Q3', name: 'Quận 3', order: 2 },
  { type: 'DISTRICT', code: 'Q4', name: 'Quận 4', order: 3 },
  { type: 'DISTRICT', code: 'Q5', name: 'Quận 5', order: 4 },
  { type: 'DISTRICT', code: 'Q6', name: 'Quận 6', order: 5 },
  { type: 'DISTRICT', code: 'Q7', name: 'Quận 7', order: 6 },
  { type: 'DISTRICT', code: 'Q8', name: 'Quận 8', order: 7 },
  { type: 'DISTRICT', code: 'Q10', name: 'Quận 10', order: 8 },
  { type: 'DISTRICT', code: 'Q11', name: 'Quận 11', order: 9 },
  { type: 'DISTRICT', code: 'Q12', name: 'Quận 12', order: 10 },
  { type: 'DISTRICT', code: 'BTAN', name: 'Bình Tân', order: 11 },
  { type: 'DISTRICT', code: 'TPHU', name: 'Tân Phú', order: 12 },
  { type: 'DISTRICT', code: 'BTHANH', name: 'Bình Thạnh', order: 13 },
  { type: 'DISTRICT', code: 'PNHUAN', name: 'Phú Nhuận', order: 14 },
  { type: 'DISTRICT', code: 'TBI', name: 'Tân Bình', order: 15 },
  { type: 'DISTRICT', code: 'GVAP', name: 'Gò Vấp', order: 16 },
  { type: 'DISTRICT', code: 'NHBE', name: 'Nhà Bè', order: 17 },
  { type: 'DISTRICT', code: 'CCHI', name: 'Củ Chi', order: 18 },
  { type: 'DISTRICT', code: 'HMON', name: 'Hóc Môn', order: 19 },
  { type: 'DISTRICT', code: 'BCHANH', name: 'Bình Chánh', order: 20 },
  { type: 'DISTRICT', code: 'THUDUC', name: 'Thủ Đức', order: 21 },
  { type: 'DISTRICT', code: 'CGIO', name: 'Cần Giờ', order: 22 },

  // ── OCCUPATION (Nghề nghiệp) ─────────────────────────────────────────────
  // Subject.occupationId trỏ tới directories(type=OCCUPATION) nhưng danh mục này
  // TRƯỚC ĐÂY KHÔNG ĐƯỢC SEED → ô chọn nghề nghiệp rỗng trên mọi môi trường.
  // Giá trị lấy nguyên từ dropdown `nghe_nghiep` của hệ thống cũ (7 lựa chọn).
  { type: 'OCCUPATION', code: 'CN', name: 'Công nhân', order: 1 },
  { type: 'OCCUPATION', code: 'ND', name: 'Nông dân', order: 2 },
  { type: 'OCCUPATION', code: 'HSSV', name: 'Học sinh, sinh viên', order: 3 },
  { type: 'OCCUPATION', code: 'CCVC', name: 'Công chức, viên chức', order: 4 },
  { type: 'OCCUPATION', code: 'LDTD', name: 'Lao động tự do', order: 5 },
  { type: 'OCCUPATION', code: 'KHONG', name: 'Không nghề nghiệp', order: 6 },
  { type: 'OCCUPATION', code: 'KHAC', name: 'Nghề khác', order: 7 },

  // ── NATIONALITY (Quốc tịch) ──────────────────────────────────────────────
  // Subject.nationalityId trỏ tới directories(type=NATIONALITY) — cũng chưa từng
  // được seed. Hệ cũ chỉ phân biệt Việt Nam / người nước ngoài (`tieu_chi_khac`).
  { type: 'NATIONALITY', code: 'VN', name: 'Việt Nam', order: 1 },
  { type: 'NATIONALITY', code: 'NN', name: 'Người nước ngoài', order: 2 },
  { type: 'NATIONALITY', code: 'KXD', name: 'Chưa xác định', order: 3 },

  // ── CAN_CU_KHOI_TO (Căn cứ khởi tố vụ án — BLTTHS Đ.143) ──────────────────
  // PR 4 v0.38.3.0 — Hybrid pattern: code = CaseProvenance enum value (Prisma).
  // Memory v0.37.2.4 P0 lesson: Directory.code MUST match enum, không phải Vietnamese.
  // Frontend render label từ Directory.name, submit value = Directory.code (enum).
  // Source: vbpl.vn — https://thuvienphapluat.vn/.../450956 (Đ.143 BLTTHS 2015)
  { type: 'CAN_CU_KHOI_TO', code: 'FROM_PETITION',        name: 'Khởi tố từ Đơn thư', order: 1 },
  { type: 'CAN_CU_KHOI_TO', code: 'FROM_INCIDENT',        name: 'Khởi tố từ Vụ việc', order: 2 },
  { type: 'CAN_CU_KHOI_TO', code: 'DIRECT_DISCOVERY',     name: 'CQĐT phát hiện trực tiếp', order: 3 },
  { type: 'CAN_CU_KHOI_TO', code: 'TRANSFERRED',          name: 'Chuyển từ cơ quan khác', order: 4 },
  { type: 'CAN_CU_KHOI_TO', code: 'SELF_SURRENDER',       name: 'Người phạm tội tự thú', order: 5 },
  { type: 'CAN_CU_KHOI_TO', code: 'PROSECUTOR_PROPOSAL',  name: 'Kiến nghị khởi tố của VKS', order: 6 },
  { type: 'CAN_CU_KHOI_TO', code: 'OTHER_LEGAL_SOURCE',   name: 'Nguồn pháp lý khác', order: 7 },

  // ── LY_DO_KHONG_KHOI_TO (Lý do không khởi tố — BLTTHS Đ.157, 8 căn cứ) ────
  // Source: luatvietnam.vn — https://luatvietnam.vn/.../99443 (Đ.157 BLTTHS)
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'KHONG_CO_SU_VIEC',      name: 'Không có sự việc phạm tội', order: 1 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'KHONG_CAU_THANH',       name: 'Hành vi không cấu thành tội phạm', order: 2 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'CHUA_DEN_TUOI',         name: 'Người chưa đến tuổi chịu trách nhiệm hình sự', order: 3 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'DA_CO_BAN_AN',          name: 'Đã có bản án hoặc quyết định đình chỉ có hiệu lực pháp luật', order: 4 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'HET_THOI_HIEU',         name: 'Đã hết thời hiệu truy cứu trách nhiệm hình sự', order: 5 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'DAI_XA',                name: 'Tội phạm đã được đại xá', order: 6 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'NGUOI_DA_CHET',         name: 'Người thực hiện hành vi đã chết (trừ trường hợp tái thẩm cho người khác)', order: 7 },
  { type: 'LY_DO_KHONG_KHOI_TO', code: 'KHONG_YEU_CAU_BI_HAI',  name: 'Tội thuộc K.1 Đ.134/135/136/138/139/141/143/155/156 BLHS mà bị hại không yêu cầu khởi tố', order: 8 },

  // ── EVIDENCE_TYPE (Loại vật chứng) ───────────────────────────────────────
  { type: 'EVIDENCE_TYPE', code: 'TIEN', name: 'Tiền', order: 1 },
  { type: 'EVIDENCE_TYPE', code: 'TL', name: 'Tài liệu', order: 2 },
  { type: 'EVIDENCE_TYPE', code: 'DV', name: 'Đồ vật', order: 3 },
  { type: 'EVIDENCE_TYPE', code: 'VK', name: 'Vũ khí', order: 4 },
  { type: 'EVIDENCE_TYPE', code: 'MT', name: 'Ma túy', order: 5 },
  { type: 'EVIDENCE_TYPE', code: 'KHAC', name: 'Khác', order: 6 },

  // ── CASE_CLASSIFICATION (Phân loại vụ án ban đầu) ────────────────────────
  { type: 'CASE_CLASSIFICATION', code: 'HS', name: 'Hình sự', order: 1 },
  { type: 'CASE_CLASSIFICATION', code: 'KT', name: 'Kinh tế', order: 2 },
  { type: 'CASE_CLASSIFICATION', code: 'MT', name: 'Ma túy', order: 3 },
  { type: 'CASE_CLASSIFICATION', code: 'ANTT', name: 'An ninh trật tự', order: 4 },
  { type: 'CASE_CLASSIFICATION', code: 'KHAC', name: 'Khác', order: 5 },

  // ── PROSECUTION_OFFICE (Viện Kiểm sát) ──────────────────────────────────
  { type: 'PROSECUTION_OFFICE', code: 'VKS-TC', name: 'Viện Kiểm sát nhân dân tối cao', order: 1 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-TP', name: 'Viện Kiểm sát nhân dân TP.HCM', order: 2 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-HN', name: 'Viện Kiểm sát nhân dân TP. Hà Nội', order: 3 },
  { type: 'PROSECUTION_OFFICE', code: 'VKS-DN', name: 'Viện Kiểm sát nhân dân TP. Đà Nẵng', order: 4 },

  // ── PROVINCE (Tỉnh/Thành phố — cải cách hành chính 2025, 34 đơn vị) ──────
  { type: 'PROVINCE', code: 'HCM', name: 'Thành phố Hồ Chí Minh', order: 1 },
  { type: 'PROVINCE', code: 'HN',  name: 'Hà Nội', order: 2 },
  { type: 'PROVINCE', code: 'DN',  name: 'Đà Nẵng', order: 3 },
  { type: 'PROVINCE', code: 'HP',  name: 'Hải Phòng', order: 4 },
  { type: 'PROVINCE', code: 'CT',  name: 'Cần Thơ', order: 5 },
  { type: 'PROVINCE', code: 'HUE', name: 'Huế', order: 6 },
  { type: 'PROVINCE', code: 'AG',  name: 'An Giang', order: 7 },
  { type: 'PROVINCE', code: 'BP',  name: 'Bình Phước', order: 8 },
  { type: 'PROVINCE', code: 'CM',  name: 'Cà Mau', order: 9 },
  { type: 'PROVINCE', code: 'CB',  name: 'Cao Bằng', order: 10 },
  { type: 'PROVINCE', code: 'DB',  name: 'Điện Biên', order: 11 },
  { type: 'PROVINCE', code: 'DLK', name: 'Đắk Lắk', order: 12 },
  { type: 'PROVINCE', code: 'DT',  name: 'Đồng Tháp', order: 13 },
  { type: 'PROVINCE', code: 'DNA', name: 'Đồng Nai', order: 14 },
  { type: 'PROVINCE', code: 'GL',  name: 'Gia Lai', order: 15 },
  { type: 'PROVINCE', code: 'HY',  name: 'Hưng Yên', order: 16 },
  { type: 'PROVINCE', code: 'KH',  name: 'Khánh Hòa', order: 17 },
  { type: 'PROVINCE', code: 'LCI', name: 'Lào Cai', order: 18 },
  { type: 'PROVINCE', code: 'LDG', name: 'Lâm Đồng', order: 19 },
  { type: 'PROVINCE', code: 'LA',  name: 'Long An', order: 20 },
  { type: 'PROVINCE', code: 'NAN', name: 'Nghệ An', order: 21 },
  { type: 'PROVINCE', code: 'NB',  name: 'Ninh Bình', order: 22 },
  { type: 'PROVINCE', code: 'NT',  name: 'Ninh Thuận', order: 23 },
  { type: 'PROVINCE', code: 'PT',  name: 'Phú Thọ', order: 24 },
  { type: 'PROVINCE', code: 'QB',  name: 'Quảng Bình', order: 25 },
  { type: 'PROVINCE', code: 'QN',  name: 'Quảng Ngãi', order: 26 },
  { type: 'PROVINCE', code: 'QNI', name: 'Quảng Ninh', order: 27 },
  { type: 'PROVINCE', code: 'TH',  name: 'Thanh Hóa', order: 28 },
  { type: 'PROVINCE', code: 'TN',  name: 'Thái Nguyên', order: 29 },
  { type: 'PROVINCE', code: 'TQ',  name: 'Tuyên Quang', order: 30 },
  { type: 'PROVINCE', code: 'TYN', name: 'Tây Ninh', order: 31 },
  { type: 'PROVINCE', code: 'VL',  name: 'Vĩnh Long', order: 32 },

  // ── TDC_SOURCE entries removed in v0.30.0.3 ─────────────────────────────
  // The "Loại nguồn tin" field now uses hardcoded LOAI_NGUON_TIN_OPTIONS
  // (frontend/src/shared/enums/status-labels.ts) derived from the Prisma enum
  // LoaiNguonTin. Directory codes here never matched the enum (TO_GIAC_CA_NHAN
  // vs TO_GIAC), so every form submission failed @IsEnum validation. See PR #75.

  // ── TDC_CASE_TYPE (Loại vụ TĐC) ─────────────────────────────────────────
  { type: 'TDC_CASE_TYPE', code: 'KHOI_TO_TU_TO_GIAC', name: 'Khởi tố từ tố giác', order: 1 },
  { type: 'TDC_CASE_TYPE', code: 'KHOI_TO_TU_TIN_BAO', name: 'Khởi tố từ tin báo', order: 2 },
  { type: 'TDC_CASE_TYPE', code: 'CHUYEN_TU_VU_VIEC',  name: 'Chuyển từ vụ việc', order: 3 },
  { type: 'TDC_CASE_TYPE', code: 'KHAC',               name: 'Khác', order: 4 },

  // ── DOCUMENT_TYPE (Loại tài liệu / hồ sơ) ───────────────────────────────
  { type: 'DOCUMENT_TYPE', code: 'VAN_BAN',   name: 'Văn bản', order: 1 },
  { type: 'DOCUMENT_TYPE', code: 'HINH_ANH',  name: 'Hình ảnh', order: 2 },
  { type: 'DOCUMENT_TYPE', code: 'VIDEO',     name: 'Video', order: 3 },
  { type: 'DOCUMENT_TYPE', code: 'AM_THANH',  name: 'Âm thanh', order: 4 },
  { type: 'DOCUMENT_TYPE', code: 'KHAC',      name: 'Khác', order: 5 },

  // ── INCIDENT_LEVEL (Mức độ nghiêm trọng) ────────────────────────────────
  { type: 'INCIDENT_LEVEL', code: 'NHE',              name: 'Nhẹ', order: 1 },
  { type: 'INCIDENT_LEVEL', code: 'TRUNG_BINH',       name: 'Trung bình', order: 2 },
  { type: 'INCIDENT_LEVEL', code: 'NGHIEM_TRONG',     name: 'Nghiêm trọng', order: 3 },
  { type: 'INCIDENT_LEVEL', code: 'RAT_NGHIEM_TRONG', name: 'Rất nghiêm trọng', order: 4 },
  { type: 'INCIDENT_LEVEL', code: 'DBNT',             name: 'Đặc biệt nghiêm trọng', order: 5 },

  // ── UNIT (Đơn vị công an — theo cải cách hành chính 2025) ───────────────
  { type: 'UNIT', code: 'CA_TPHCM',   name: 'Công an TP. Hồ Chí Minh', order: 1 },
  { type: 'UNIT', code: 'PC02_TPHCM', name: 'PC02 - Phòng CSĐT tội phạm về TTXH', order: 2 },
  { type: 'UNIT', code: 'CA_HN',      name: 'Công an TP. Hà Nội', order: 3 },
  { type: 'UNIT', code: 'CA_DN',      name: 'Công an TP. Đà Nẵng', order: 4 },
  { type: 'UNIT', code: 'CA_HP',      name: 'Công an TP. Hải Phòng', order: 5 },
  { type: 'UNIT', code: 'CA_CT',      name: 'Công an TP. Cần Thơ', order: 6 },

  // ── CRIME — Tội danh theo BLHS 2015 (sửa đổi 2017, 2022) ─────────────────
  // Dùng cho PC02 — Phòng CSĐT tội phạm về trật tự xã hội
  // Nguồn: Bộ Luật Hình Sự 2015 (Luật số 100/2015/QH13), sửa đổi theo Luật 12/2017/QH14

  // Chương XIV: Xâm phạm tính mạng, sức khỏe, nhân phẩm, danh dự
  { type: 'CRIME', code: 'D123',   name: 'Giết người (Điều 123)', order: 1 },
  { type: 'CRIME', code: 'D125',   name: 'Giết người trong trạng thái tinh thần bị kích động mạnh (Điều 125)', order: 2 },
  { type: 'CRIME', code: 'D126',   name: 'Giết người do vượt quá giới hạn phòng vệ chính đáng (Điều 126)', order: 3 },
  { type: 'CRIME', code: 'D128',   name: 'Vô ý làm chết người (Điều 128)', order: 4 },
  { type: 'CRIME', code: 'D134',   name: 'Cố ý gây thương tích (Điều 134)', order: 5 },
  { type: 'CRIME', code: 'D135',   name: 'Cố ý gây thương tích trong trạng thái tinh thần bị kích động mạnh (Điều 135)', order: 6 },
  { type: 'CRIME', code: 'D138',   name: 'Vô ý gây thương tích (Điều 138)', order: 7 },
  { type: 'CRIME', code: 'D140',   name: 'Hành hạ người khác (Điều 140)', order: 8 },
  { type: 'CRIME', code: 'D141',   name: 'Hiếp dâm (Điều 141)', order: 9 },
  { type: 'CRIME', code: 'D142',   name: 'Hiếp dâm người dưới 16 tuổi (Điều 142)', order: 10 },
  { type: 'CRIME', code: 'D143',   name: 'Cưỡng dâm (Điều 143)', order: 11 },
  { type: 'CRIME', code: 'D145',   name: 'Giao cấu với người từ đủ 13 đến dưới 16 tuổi (Điều 145)', order: 12 },
  { type: 'CRIME', code: 'D146',   name: 'Dâm ô đối với người dưới 16 tuổi (Điều 146)', order: 13 },
  { type: 'CRIME', code: 'D150',   name: 'Mua bán người (Điều 150)', order: 14 },
  { type: 'CRIME', code: 'D151',   name: 'Mua bán người dưới 16 tuổi (Điều 151)', order: 15 },

  // Chương XV: Xâm phạm quyền tự do của con người
  { type: 'CRIME', code: 'D157',   name: 'Bắt, giữ hoặc giam người trái pháp luật (Điều 157)', order: 16 },
  { type: 'CRIME', code: 'D158',   name: 'Xâm phạm chỗ ở của người khác (Điều 158)', order: 17 },

  // Chương XVI: Xâm phạm sở hữu
  { type: 'CRIME', code: 'D168',   name: 'Cướp tài sản (Điều 168)', order: 18 },
  { type: 'CRIME', code: 'D169',   name: 'Bắt cóc nhằm chiếm đoạt tài sản (Điều 169)', order: 19 },
  { type: 'CRIME', code: 'D170',   name: 'Cưỡng đoạt tài sản (Điều 170)', order: 20 },
  { type: 'CRIME', code: 'D171',   name: 'Cướp giật tài sản (Điều 171)', order: 21 },
  { type: 'CRIME', code: 'D172',   name: 'Công nhiên chiếm đoạt tài sản (Điều 172)', order: 22 },
  { type: 'CRIME', code: 'D173',   name: 'Trộm cắp tài sản (Điều 173)', order: 23 },
  { type: 'CRIME', code: 'D174',   name: 'Lừa đảo chiếm đoạt tài sản (Điều 174)', order: 24 },
  { type: 'CRIME', code: 'D175',   name: 'Lạm dụng tín nhiệm chiếm đoạt tài sản (Điều 175)', order: 25 },
  { type: 'CRIME', code: 'D178',   name: 'Hủy hoại hoặc cố ý làm hư hỏng tài sản (Điều 178)', order: 26 },

  // Chương XVII: Tội phạm kinh tế
  { type: 'CRIME', code: 'D206',   name: 'Cho vay lãi nặng trong giao dịch dân sự (Điều 206)', order: 27 },
  { type: 'CRIME', code: 'D215',   name: 'Vi phạm quy định về hoạt động ngân hàng (Điều 215)', order: 28 },

  // Chương XVIII: Tội phạm ma túy
  { type: 'CRIME', code: 'D249',   name: 'Tàng trữ trái phép chất ma túy (Điều 249)', order: 29 },
  { type: 'CRIME', code: 'D250',   name: 'Vận chuyển trái phép chất ma túy (Điều 250)', order: 31 },
  { type: 'CRIME', code: 'D251',   name: 'Mua bán trái phép chất ma túy (Điều 251)', order: 32 },
  { type: 'CRIME', code: 'D252',   name: 'Chiếm đoạt chất ma túy (Điều 252)', order: 33 },
  { type: 'CRIME', code: 'D255',   name: 'Tổ chức sử dụng trái phép chất ma túy (Điều 255)', order: 34 },
  { type: 'CRIME', code: 'D256',   name: 'Chứa chấp việc sử dụng trái phép chất ma túy (Điều 256)', order: 35 },
  { type: 'CRIME', code: 'D258',   name: 'Sử dụng trái phép chất ma túy (Điều 258)', order: 36 },

  // Chương XIX: An toàn công cộng, trật tự công cộng
  { type: 'CRIME', code: 'D260',   name: 'Vi phạm quy định về an toàn giao thông đường bộ (Điều 260)', order: 37 },
  { type: 'CRIME', code: 'D304',   name: 'Tàng trữ, vận chuyển, sử dụng, mua bán trái phép vũ khí (Điều 304)', order: 38 },
  { type: 'CRIME', code: 'D318',   name: 'Gây rối trật tự công cộng (Điều 318)', order: 38 },
  { type: 'CRIME', code: 'D319',   name: 'Xâm phạm thi thể, mồ mả, hài cốt (Điều 319)', order: 41 },
  { type: 'CRIME', code: 'D321',   name: 'Đánh bạc (Điều 321)', order: 42 },
  { type: 'CRIME', code: 'D322',   name: 'Tổ chức đánh bạc hoặc gá bạc (Điều 322)', order: 43 },
  { type: 'CRIME', code: 'D323',   name: 'Chứa chấp hoặc tiêu thụ tài sản do người khác phạm tội mà có (Điều 323)', order: 44 },
  { type: 'CRIME', code: 'D324',   name: 'Rửa tiền (Điều 324)', order: 45 },

  // Chương XXI: Tội phạm chức vụ
  { type: 'CRIME', code: 'D353',   name: 'Tham ô tài sản (Điều 353)', order: 46 },
  { type: 'CRIME', code: 'D354',   name: 'Nhận hối lộ (Điều 354)', order: 47 },
  { type: 'CRIME', code: 'D358',   name: 'Lợi dụng chức vụ, quyền hạn gây ảnh hưởng (Điều 358)', order: 48 },

  // Khác
  { type: 'CRIME', code: 'KHAC',   name: 'Tội danh khác', order: 99 },
];

export async function seedDirectoryTypes(prismaClient: PrismaClient): Promise<void> {
  console.log(`Seeding ${DIRECTORY_DATA.length} directory type entries...`);

  let created = 0;
  let existing = 0;

  for (const entry of DIRECTORY_DATA) {
    const result = await prismaClient.directory.upsert({
      where: { type_code: { type: entry.type, code: entry.code } },
      update: { name: entry.name, order: entry.order, isActive: true },
      create: {
        type: entry.type,
        code: entry.code,
        name: entry.name,
        order: entry.order,
        isActive: true,
      },
    });

    if (result.createdAt.getTime() > Date.now() - 5000) {
      created++;
    } else {
      existing++;
    }
  }

  // Mark DISTRICT entries as legacy (no longer used for new records — cải cách 2025)
  const districtUpdated = await prismaClient.directory.updateMany({
    where: { type: 'DISTRICT' },
    data: { isActive: false },
  });
  if (districtUpdated.count > 0) {
    console.log(`  DISTRICT: ${districtUpdated.count} entries set isActive=false (legacy)`);
  }

  // Summary by type
  const types = [...new Set(DIRECTORY_DATA.map(d => d.type))];
  for (const type of types) {
    const count = await prismaClient.directory.count({ where: { type } });
    console.log(`  ${type}: ${count} entries`);
  }

  console.log(`Directory types done. ${created} created, ${existing} already existed.`);
}

// Standalone mode — run directly with: npx ts-node prisma/seed-directory-types.ts
if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const standaloneClient = new PrismaClient({ adapter });
  seedDirectoryTypes(standaloneClient)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await standaloneClient.$disconnect();
    });
}
