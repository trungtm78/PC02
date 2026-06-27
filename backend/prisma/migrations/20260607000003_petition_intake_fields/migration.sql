-- Field-parity Đơn thư (giai đoạn tiếp nhận). Tất cả nullable/default → an toàn với data cũ. Plain DDL.
ALTER TABLE "petitions"
  ADD COLUMN "senderIdNumber" TEXT,
  ADD COLUMN "senderIdIssueDate" TIMESTAMP(3),
  ADD COLUMN "senderIdIssuePlace" TEXT,
  ADD COLUMN "senderIsAnonymous" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "loaiThongTin" TEXT,
  ADD COLUMN "soPhieuChuyen" TEXT,
  ADD COLUMN "ngayPhieuChuyen" TIMESTAMP(3),
  ADD COLUMN "ngayTiepNhanNguonTin" TIMESTAMP(3),
  ADD COLUMN "toiDanhBanDau" TEXT,
  ADD COLUMN "crimeChinhId" TEXT,
  ADD COLUMN "noiXayRa" TEXT,
  ADD COLUMN "ngayGiaoDonViGiaiQuyet" TIMESTAMP(3),
  ADD COLUMN "laCongNgheCao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lanhDaoToTung" TEXT,
  ADD COLUMN "ketQuaXuLyKhac" TEXT;

CREATE INDEX "petitions_crimeChinhId_idx" ON "petitions"("crimeChinhId");

ALTER TABLE "petitions" ADD CONSTRAINT "petitions_crimeChinhId_fkey"
  FOREIGN KEY ("crimeChinhId") REFERENCES "crimes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
