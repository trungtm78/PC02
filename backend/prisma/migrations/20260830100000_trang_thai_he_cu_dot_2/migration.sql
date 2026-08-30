-- Đợt hai: phủ nốt các kết quả còn lại của hệ cũ để không hồ sơ nào bị bỏ lại.
--
-- Đo trên CSDL thật 30/08/2026, trong 3.307 hồ sơ chưa suy được còn: "dân sự" 233, "đình chỉ"
-- (không phải TẠM đình chỉ) 177, "phân công" 364, "xử phạt hành chính" 22. Chúng đều là kết quả
-- có thật, chỉ thiếu chỗ chứa.

ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'DA_NHAP_HO_SO_KHAC';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'DINH_CHI';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'CHUYEN_XPHC';

ALTER TYPE "incident_status" ADD VALUE IF NOT EXISTS 'DINH_CHI';

ALTER TYPE "case_status" ADD VALUE IF NOT EXISTS 'DA_NHAP_VU_KHAC';
ALTER TYPE "case_status" ADD VALUE IF NOT EXISTS 'CHUYEN_XPHC';
