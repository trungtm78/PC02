-- ND-26 — MIGRATION BASELINE (schema tiền-lịch-sử)
--
-- VÌ SAO CÓ FILE NÀY: lịch sử migration mở đầu bằng `ALTER TABLE "cases"` mà
-- KHÔNG migration nào tạo bảng `cases`. Toàn bộ 93 migration được commit một
-- lượt trong initial commit; schema trước đó chưa từng vào git — nó chỉ tồn tại
-- trong DB được dựng bằng `prisma db push`. Hệ quả: `prisma migrate deploy`
-- KHÔNG dựng nổi DB trắng, nên dựng VM mới theo docs/DEPLOY.md sẽ hỏng ngay
-- bước migrate.
--
-- NỘI DUNG: schema hiện tại TRỪ ĐI mọi thứ do 93 migration tạo ra, cộng thêm
-- hai đối tượng tiền-lịch-sử đã bị migration sau xoá (`holidays`,
-- `document_type`) — thiếu chúng thì migration chuyển dữ liệu không chạy được.
--
-- ĐÃ KIỂM CHỨNG: dựng DB trắng rồi `prisma migrate deploy` → 94/94 migration
-- áp dụng sạch. Trước khi có file này, migration thứ 1 chết ngay với
-- `relation "cases" does not exist`.
--
-- VỚI DB ĐANG CHẠY (prod/dev): chạy MỘT LẦN, không đụng dữ liệu:
--     npx prisma migrate resolve --applied 00000000000000_baseline
-- Lệnh này chỉ ghi thêm một dòng vào `_prisma_migrations`, không chạy SQL nào.
-- Xem docs/DEPLOY.md mục "Baseline migration (ND-26)".


-- ─── Bảng tiền-lịch-sử đã bị migration sau này XOÁ ───────────────────────────
-- `holidays` có từ trước migration đầu tiên và bị
-- `20260513140000_calendar_events_v2_phase3_drop_holiday` chuyển dữ liệu sang
-- `calendar_events` rồi DROP. Nó không còn trong schema.prisma, nên
-- `migrate diff --from-empty` không sinh ra — nhưng DB trắng vẫn phải có nó thì
-- migration đó mới chạy được (nó `INSERT ... SELECT FROM holidays`).
-- Nguyên văn theo model Holiday tại commit 2609f38.
CREATE TYPE "HolidayCategory" AS ENUM ('NATIONAL', 'POLICE', 'MILITARY', 'INTERNATIONAL', 'OTHER');

CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "category" "HolidayCategory" NOT NULL,
    "isOfficialDayOff" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "lunarDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "holidays_date_title_key" ON "holidays"("date", "title");
CREATE INDEX "holidays_category_idx" ON "holidays"("category");
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- `document_type` cũng có từ trước lịch sử và bị
-- `20260627000001_document_type_to_dynamic` chuyển sang danh mục động rồi DROP.
-- Nguyên văn theo enum DocumentType (@@map("document_type")) tại commit 2609f38.
CREATE TYPE "document_type" AS ENUM ('VAN_BAN', 'HINH_ANH', 'VIDEO', 'AM_THANH', 'KHAC');
-- CreateEnum
CREATE TYPE "ly_do_tam_dinh_chi_vu_an" AS ENUM ('CHUA_XAC_DINH_BI_CAN', 'KHONG_BIET_BI_CAN_O_DAU', 'BI_CAN_BENH_TAM_THAN', 'CHUA_CO_KET_QUA_GIAM_DINH', 'CHUA_CO_KET_QUA_DINH_GIA', 'CHUA_CO_KET_QUA_TUONG_TRO', 'YEU_CAU_TAI_LIEU_CHUA_CO', 'BAT_KHA_KHANG');

-- CreateEnum
CREATE TYPE "ket_qua_phuc_hoi_vu_an" AS ENUM ('KET_LUAN_DE_NGHI_TRUY_TO', 'DINH_CHI_DIEU_TRA', 'TAM_DINH_CHI_LAI', 'DANG_DIEU_TRA_XAC_MINH', 'CHUYEN_CO_QUAN_DIEU_TRA_KHAC');

-- CreateEnum
CREATE TYPE "ly_do_tam_dinh_chi_vu_viec" AS ENUM ('CHUA_CO_KET_QUA_GIAM_DINH', 'CHUA_CO_KET_QUA_DINH_GIA', 'CHUA_CO_KET_QUA_TUONG_TRO', 'YEU_CAU_TAI_LIEU_CHUA_CO', 'BAT_KHA_KHANG', 'CAN_CU_KHAC');

-- CreateEnum
CREATE TYPE "ket_qua_phuc_hoi_vu_viec" AS ENUM ('QUYET_DINH_KHOI_TO', 'QUYET_DINH_KHONG_KHOI_TO', 'TAM_DINH_CHI_LAI', 'DANG_XAC_MINH', 'CHUYEN_CO_QUAN_KHAC');

-- CreateEnum
CREATE TYPE "tien_do_khac_phuc" AS ENUM ('DANG_THUC_HIEN', 'DAM_BAO', 'CHAM_TRE', 'KHONG_DAT');

-- CreateEnum
CREATE TYPE "report_tdc_type" AS ENUM ('VU_AN', 'VU_VIEC');

-- CreateEnum
CREATE TYPE "report_tdc_status" AS ENUM ('DRAFT', 'REVIEWING', 'REJECTED', 'APPROVED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('TIEP_NHAN', 'DANG_XAC_MINH', 'DA_XAC_MINH', 'DANG_DIEU_TRA', 'TAM_DINH_CHI', 'DINH_CHI', 'DA_KET_LUAN', 'DANG_TRUY_TO', 'DANG_XET_XU', 'DA_LUU_TRU');

-- CreateEnum
CREATE TYPE "subject_status" AS ENUM ('INVESTIGATING', 'DETAINED', 'RELEASED', 'WANTED');

-- CreateEnum
CREATE TYPE "subject_type" AS ENUM ('SUSPECT', 'VICTIM', 'WITNESS');

-- CreateEnum
CREATE TYPE "petition_status" AS ENUM ('MOI_TIEP_NHAN', 'DANG_XU_LY', 'CHO_PHE_DUYET', 'DA_LUU_DON', 'DA_GIAI_QUYET', 'DA_CHUYEN_VU_VIEC', 'DA_CHUYEN_VU_AN');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('TIEP_NHAN', 'DANG_XAC_MINH', 'DA_PHAN_CONG', 'DA_GIAI_QUYET', 'TAM_DINH_CHI', 'QUA_HAN', 'DA_CHUYEN_VU_AN', 'KHONG_KHOI_TO', 'CHUYEN_XPHC', 'TDC_HET_THOI_HIEU', 'TDC_HTH_KHONG_KT', 'PHUC_HOI_NGUON_TIN', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC', 'PHAN_LOAI_DAN_SU');

-- CreateEnum
CREATE TYPE "proposal_status" AS ENUM ('CHO_GUI', 'DA_GUI', 'CO_PHAN_HOI', 'DA_XU_LY');

-- CreateEnum
CREATE TYPE "guidance_status" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "exchange_status" AS ENUM ('OPEN', 'CLOSED', 'PENDING');

-- CreateEnum
CREATE TYPE "delegation_status" AS ENUM ('PENDING', 'RECEIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "conclusion_status" AS ENUM ('DU_THAO', 'CHO_DUYET', 'DA_DUYET');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('READ', 'WRITE');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "conditions" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "workId" TEXT,
    "phone" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "canDispatch" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directories" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "crime" TEXT,
    "status" "case_status" NOT NULL DEFAULT 'TIEP_NHAN',
    "investigatorId" TEXT,
    "deadline" TIMESTAMP(3),
    "unit" TEXT,
    "subjectsCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "laCongNgheCao" BOOLEAN NOT NULL DEFAULT false,
    "lyDoTamDinhChiText" TEXT,
    "lyDoTamDinhChiVuAn" "ly_do_tam_dinh_chi_vu_an",
    "soQuyetDinhTamDinhChi" TEXT,
    "ngayTamDinhChi" TIMESTAMP(3),
    "soLanTamDinhChi" INTEGER NOT NULL DEFAULT 0,
    "soLanGiaHan" INTEGER NOT NULL DEFAULT 0,
    "daRaSoat" BOOLEAN NOT NULL DEFAULT false,
    "ngayRaSoat" TIMESTAMP(3),
    "soQuyetDinhPhucHoi" TEXT,
    "ngayPhucHoi" TIMESTAMP(3),
    "ketQuaPhucHoiVuAn" "ket_qua_phuc_hoi_vu_an",
    "ngayHetThoiHieu" TIMESTAMP(3),
    "assignedTeamId" TEXT,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT NOT NULL DEFAULT 'MALE',
    "idNumber" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "occupationId" TEXT,
    "nationalityId" TEXT,
    "districtId" TEXT,
    "wardId" TEXT,
    "caseId" TEXT NOT NULL,
    "crimeId" TEXT,
    "type" "subject_type" NOT NULL DEFAULT 'SUSPECT',
    "status" "subject_status" NOT NULL DEFAULT 'INVESTIGATING',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "lawFirm" TEXT,
    "barNumber" TEXT NOT NULL,
    "phone" TEXT,
    "caseId" TEXT NOT NULL,
    "subjectId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petitions" (
    "id" TEXT NOT NULL,
    "stt" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "unit" TEXT,
    "enteredById" TEXT,
    "senderName" TEXT NOT NULL,
    "senderBirthYear" TEXT,
    "senderAddress" TEXT,
    "senderPhone" TEXT,
    "senderEmail" TEXT,
    "suspectedPerson" TEXT,
    "suspectedAddress" TEXT,
    "petitionType" TEXT,
    "priority" TEXT,
    "summary" TEXT,
    "detailContent" TEXT,
    "attachmentsNote" TEXT,
    "deadline" TIMESTAMP(3),
    "assignedToId" TEXT,
    "notes" TEXT,
    "status" "petition_status" NOT NULL DEFAULT 'MOI_TIEP_NHAN',
    "linkedCaseId" TEXT,
    "linkedIncidentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedTeamId" TEXT,

    CONSTRAINT "petitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "incidentType" TEXT,
    "description" TEXT,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "unitId" TEXT,
    "investigatorId" TEXT,
    "status" "incident_status" NOT NULL DEFAULT 'TIEP_NHAN',
    "sourcePetitionId" TEXT,
    "doiTuongCaNhan" TEXT,
    "doiTuongToChuc" TEXT,
    "loaiDonVu" TEXT,
    "benVu" TEXT,
    "donViGiaiQuyet" TEXT,
    "ngayDeXuat" TIMESTAMP(3),
    "ketQuaXuLy" TEXT,
    "tinhTrangHoSo" TEXT,
    "tinhTrangThoiHieu" TEXT,
    "nguoiQuyetDinh" TEXT,
    "chuyenDenDonVi" TEXT,
    "chuyenTuDonVi" TEXT,
    "soQuyetDinh" TEXT,
    "ngayQuyetDinh" TIMESTAMP(3),
    "lyDoKhongKhoiTo" TEXT,
    "lyDoTamDinhChiText" TEXT,
    "lyDoTamDinhChiVuViec" "ly_do_tam_dinh_chi_vu_viec",
    "laCongNgheCaoVV" BOOLEAN NOT NULL DEFAULT false,
    "soQuyetDinhTamDinhChiVV" TEXT,
    "ngayTamDinhChiVV" TIMESTAMP(3),
    "soLanTamDinhChiVV" INTEGER NOT NULL DEFAULT 0,
    "daRaSoatVV" BOOLEAN NOT NULL DEFAULT false,
    "ngayRaSoatVV" TIMESTAMP(3),
    "soQuyetDinhPhucHoiVV" TEXT,
    "ngayPhucHoiVV" TIMESTAMP(3),
    "ketQuaPhucHoiVuViec" "ket_qua_phuc_hoi_vu_viec",
    "ngayHetThoiHieuVV" TIMESTAMP(3),
    "diaChiXayRa" TEXT,
    "sdtNguoiToGiac" TEXT,
    "diaChiNguoiToGiac" TEXT,
    "cmndNguoiToGiac" TEXT,
    "mergedIntoId" TEXT,
    "linkedCaseId" TEXT,
    "canBoNhapId" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedTeamId" TEXT,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_status_history" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fromStatus" "incident_status" NOT NULL,
    "toStatus" "incident_status" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "documentType" "document_type" NOT NULL DEFAULT 'VAN_BAN',
    "caseId" TEXT,
    "incidentId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "proposalNumber" TEXT NOT NULL,
    "relatedCaseId" TEXT,
    "caseType" TEXT,
    "content" TEXT NOT NULL,
    "unit" TEXT,
    "createdById" TEXT,
    "status" "proposal_status" NOT NULL DEFAULT 'CHO_GUI',
    "sentDate" TIMESTAMP(3),
    "response" TEXT,
    "responseDate" TIMESTAMP(3),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_records" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit" TEXT,
    "createdById" TEXT,
    "guidedPerson" TEXT NOT NULL,
    "guidedPersonPhone" TEXT,
    "subject" TEXT,
    "guidanceContent" TEXT NOT NULL,
    "notes" TEXT,
    "status" "guidance_status" NOT NULL DEFAULT 'PENDING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guidance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" TEXT NOT NULL,
    "recordCode" TEXT,
    "recordType" TEXT,
    "senderUnit" TEXT,
    "receiverUnit" TEXT,
    "subject" TEXT,
    "status" "exchange_status" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_messages" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "senderId" TEXT,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "delegationNumber" TEXT NOT NULL,
    "delegationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivingUnit" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "delegation_status" NOT NULL DEFAULT 'PENDING',
    "completedDate" TIMESTAMP(3),
    "relatedCaseId" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conclusions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "approvedById" TEXT,
    "status" "conclusion_status" NOT NULL DEFAULT 'DU_THAO',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "subjectId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_classes" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_teams" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_teams_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "data_access_grants" (
    "id" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "legalBasis" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vks_meeting_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "incidentId" TEXT,
    "ngayTrao" TIMESTAMP(3) NOT NULL,
    "noiDung" TEXT NOT NULL,
    "soQuyetDinh" TEXT,
    "ketQua" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vks_meeting_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspension_action_plans" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "incidentId" TEXT,
    "ngayLap" TIMESTAMP(3) NOT NULL,
    "bienPhap" TEXT NOT NULL,
    "thoiHan" TIMESTAMP(3),
    "tienDo" "tien_do_khac_phuc" NOT NULL DEFAULT 'DANG_THUC_HIEN',
    "ketQua" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suspension_action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_tdc_drafts" (
    "id" TEXT NOT NULL,
    "loaiBaoCao" "report_tdc_type" NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "teamIds" TEXT[],
    "status" "report_tdc_status" NOT NULL DEFAULT 'DRAFT',
    "computedData" JSONB NOT NULL,
    "adjustedData" JSONB,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "report_tdc_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_mappings" (
    "id" TEXT NOT NULL,
    "oldWard" TEXT NOT NULL,
    "oldDistrict" TEXT NOT NULL,
    "newWard" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_subject_key" ON "permissions"("action", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "directories_type_code_key" ON "directories"("type", "code");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_deadline_idx" ON "cases"("deadline");

-- CreateIndex
CREATE INDEX "cases_deletedAt_idx" ON "cases"("deletedAt");

-- CreateIndex
CREATE INDEX "cases_assignedTeamId_idx" ON "cases"("assignedTeamId");

-- CreateIndex
CREATE INDEX "cases_createdAt_idx" ON "cases"("createdAt");

-- CreateIndex
CREATE INDEX "cases_unit_idx" ON "cases"("unit");

-- CreateIndex
CREATE INDEX "subjects_caseId_idx" ON "subjects"("caseId");

-- CreateIndex
CREATE INDEX "subjects_crimeId_idx" ON "subjects"("crimeId");

-- CreateIndex
CREATE INDEX "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE INDEX "subjects_type_idx" ON "subjects"("type");

-- CreateIndex
CREATE INDEX "subjects_deletedAt_idx" ON "subjects"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lawyers_barNumber_key" ON "lawyers"("barNumber");

-- CreateIndex
CREATE INDEX "lawyers_caseId_idx" ON "lawyers"("caseId");

-- CreateIndex
CREATE INDEX "lawyers_subjectId_idx" ON "lawyers"("subjectId");

-- CreateIndex
CREATE INDEX "lawyers_deletedAt_idx" ON "lawyers"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "petitions_stt_key" ON "petitions"("stt");

-- CreateIndex
CREATE INDEX "petitions_status_idx" ON "petitions"("status");

-- CreateIndex
CREATE INDEX "petitions_receivedDate_idx" ON "petitions"("receivedDate");

-- CreateIndex
CREATE INDEX "petitions_deadline_idx" ON "petitions"("deadline");

-- CreateIndex
CREATE INDEX "petitions_senderName_idx" ON "petitions"("senderName");

-- CreateIndex
CREATE INDEX "petitions_deletedAt_idx" ON "petitions"("deletedAt");

-- CreateIndex
CREATE INDEX "petitions_assignedTeamId_idx" ON "petitions"("assignedTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_code_key" ON "incidents"("code");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_deletedAt_idx" ON "incidents"("deletedAt");

-- CreateIndex
CREATE INDEX "incidents_assignedTeamId_idx" ON "incidents"("assignedTeamId");

-- CreateIndex
CREATE INDEX "incidents_ngayDeXuat_idx" ON "incidents"("ngayDeXuat");

-- CreateIndex
CREATE INDEX "incidents_createdAt_idx" ON "incidents"("createdAt");

-- CreateIndex
CREATE INDEX "incidents_unitId_idx" ON "incidents"("unitId");

-- CreateIndex
CREATE INDEX "incident_status_history_incidentId_idx" ON "incident_status_history"("incidentId");

-- CreateIndex
CREATE INDEX "documents_caseId_idx" ON "documents"("caseId");

-- CreateIndex
CREATE INDEX "documents_incidentId_idx" ON "documents"("incidentId");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_documentType_idx" ON "documents"("documentType");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposalNumber_key" ON "proposals"("proposalNumber");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "proposals_deletedAt_idx" ON "proposals"("deletedAt");

-- CreateIndex
CREATE INDEX "proposals_createdAt_idx" ON "proposals"("createdAt");

-- CreateIndex
CREATE INDEX "proposals_createdById_idx" ON "proposals"("createdById");

-- CreateIndex
CREATE INDEX "guidance_records_status_idx" ON "guidance_records"("status");

-- CreateIndex
CREATE INDEX "guidance_records_deletedAt_idx" ON "guidance_records"("deletedAt");

-- CreateIndex
CREATE INDEX "exchanges_status_idx" ON "exchanges"("status");

-- CreateIndex
CREATE INDEX "exchanges_deletedAt_idx" ON "exchanges"("deletedAt");

-- CreateIndex
CREATE INDEX "exchange_messages_exchangeId_idx" ON "exchange_messages"("exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "delegations_delegationNumber_key" ON "delegations"("delegationNumber");

-- CreateIndex
CREATE INDEX "delegations_status_idx" ON "delegations"("status");

-- CreateIndex
CREATE INDEX "delegations_deletedAt_idx" ON "delegations"("deletedAt");

-- CreateIndex
CREATE INDEX "conclusions_caseId_idx" ON "conclusions"("caseId");

-- CreateIndex
CREATE INDEX "conclusions_status_idx" ON "conclusions"("status");

-- CreateIndex
CREATE INDEX "conclusions_deletedAt_idx" ON "conclusions"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "master_classes_type_idx" ON "master_classes"("type");

-- CreateIndex
CREATE INDEX "master_classes_isActive_idx" ON "master_classes"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "master_classes_type_code_key" ON "master_classes"("type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE INDEX "teams_parentId_idx" ON "teams"("parentId");

-- CreateIndex
CREATE INDEX "teams_level_idx" ON "teams"("level");

-- CreateIndex
CREATE INDEX "user_teams_teamId_idx" ON "user_teams"("teamId");

-- CreateIndex
CREATE INDEX "data_access_grants_granteeId_idx" ON "data_access_grants"("granteeId");

-- CreateIndex
CREATE UNIQUE INDEX "data_access_grants_granteeId_teamId_accessLevel_key" ON "data_access_grants"("granteeId", "teamId", "accessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "vks_meeting_records_caseId_idx" ON "vks_meeting_records"("caseId");

-- CreateIndex
CREATE INDEX "vks_meeting_records_incidentId_idx" ON "vks_meeting_records"("incidentId");

-- CreateIndex
CREATE INDEX "suspension_action_plans_caseId_idx" ON "suspension_action_plans"("caseId");

-- CreateIndex
CREATE INDEX "suspension_action_plans_incidentId_idx" ON "suspension_action_plans"("incidentId");

-- CreateIndex
CREATE INDEX "report_tdc_drafts_loaiBaoCao_idx" ON "report_tdc_drafts"("loaiBaoCao");

-- CreateIndex
CREATE INDEX "report_tdc_drafts_status_idx" ON "report_tdc_drafts"("status");

-- CreateIndex
CREATE INDEX "report_tdc_drafts_fromDate_toDate_idx" ON "report_tdc_drafts"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "address_mappings_province_oldDistrict_idx" ON "address_mappings"("province", "oldDistrict");

-- CreateIndex
CREATE INDEX "address_mappings_needsReview_idx" ON "address_mappings"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "address_mappings_oldWard_oldDistrict_province_key" ON "address_mappings"("oldWard", "oldDistrict", "province");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyers" ADD CONSTRAINT "lawyers_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyers" ADD CONSTRAINT "lawyers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_linkedCaseId_fkey" FOREIGN KEY ("linkedCaseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_linkedIncidentId_fkey" FOREIGN KEY ("linkedIncidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_linkedCaseId_fkey" FOREIGN KEY ("linkedCaseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_canBoNhapId_fkey" FOREIGN KEY ("canBoNhapId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guidance_records" ADD CONSTRAINT "guidance_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchanges" ADD CONSTRAINT "exchanges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_messages" ADD CONSTRAINT "exchange_messages_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_messages" ADD CONSTRAINT "exchange_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusions" ADD CONSTRAINT "conclusions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_grants" ADD CONSTRAINT "data_access_grants_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_grants" ADD CONSTRAINT "data_access_grants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_grants" ADD CONSTRAINT "data_access_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vks_meeting_records" ADD CONSTRAINT "vks_meeting_records_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vks_meeting_records" ADD CONSTRAINT "vks_meeting_records_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vks_meeting_records" ADD CONSTRAINT "vks_meeting_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_action_plans" ADD CONSTRAINT "suspension_action_plans_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_action_plans" ADD CONSTRAINT "suspension_action_plans_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspension_action_plans" ADD CONSTRAINT "suspension_action_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tdc_drafts" ADD CONSTRAINT "report_tdc_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tdc_drafts" ADD CONSTRAINT "report_tdc_drafts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tdc_drafts" ADD CONSTRAINT "report_tdc_drafts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tdc_drafts" ADD CONSTRAINT "report_tdc_drafts_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
