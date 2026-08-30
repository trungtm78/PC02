-- Kết quả xử lý mà hệ cũ CÓ GHI nhưng hệ mới chưa có chỗ chứa.
--
-- Đo trên CSDL thật 30/08/2026: 5.094 đơn thư mang một trong sáu kết quả dưới đây, nhưng
-- `petition_status` chỉ có bảy giá trị và không giá trị nào diễn đạt được chúng. Hệ quả là toàn
-- bộ 46.741 đơn thư đứng ở MOI_TIEP_NHAN, kể cả đơn đã trả cho công dân từ 2019.
--
-- Ép chúng vào DA_GIAI_QUYET là nói sai: trả đơn KHÔNG phải giải quyết xong.

ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'DA_TRA_DON';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'DA_HUONG_DAN';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'PHAN_LOAI_DAN_SU';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'TAM_DINH_CHI';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'KHONG_KHOI_TO';
ALTER TYPE "petition_status" ADD VALUE IF NOT EXISTS 'DA_CHUYEN_DON_VI';

-- 22 vụ án hệ cũ ghi "chuyển…"; IncidentStatus đã có giá trị này, CaseStatus thì không.
ALTER TYPE "case_status" ADD VALUE IF NOT EXISTS 'DA_CHUYEN_DON_VI';

-- Sổ ghi từng lần suy trạng thái từ chữ hệ cũ.
--
-- Không ghi vào `metadata` của hồ sơ: bảng riêng thì tra được "đã đổi những gì, vì câu chữ nào",
-- đảo ngược được, và chính nó LÀ danh sách để đưa khách hàng xác nhận.
CREATE TABLE "legacy_status_inferences" (
  "id"           TEXT PRIMARY KEY,
  "runId"        TEXT NOT NULL,
  "thucThe"      TEXT NOT NULL,          -- don_thu | vu_viec | vu_an
  "hoSoId"       TEXT NOT NULL,
  "legacyId"     INTEGER,
  "sttCu"        TEXT,                   -- STT hệ cũ — khoá để khách hàng đối chiếu
  "namCu"        TEXT,
  "maHoSo"       TEXT,                   -- mã hệ mới
  "trangThaiCu"  TEXT NOT NULL,
  "trangThaiMoi" TEXT NOT NULL,
  "ngaySuy"      TIMESTAMP(3),           -- ngày bóc từ chính câu chữ, NULL khi câu không ghi
  "nguyenVan"    TEXT NOT NULL,          -- câu gốc, để đối chiếu phán đoán
  "daApDung"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "legacy_status_inferences_runId_idx" ON "legacy_status_inferences" ("runId");
CREATE INDEX "legacy_status_inferences_sttCu_idx" ON "legacy_status_inferences" ("sttCu");
CREATE INDEX "legacy_status_inferences_hoSoId_idx" ON "legacy_status_inferences" ("hoSoId");
