-- Nới định danh Subject cho phép NULL: dữ liệu cũ nhiều nghi can/bị hại chỉ có tên.
-- Mở rộng (drop NOT NULL) — an toàn với dữ liệu hiện có.
ALTER TABLE "subjects" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
ALTER TABLE "subjects" ALTER COLUMN "idNumber" DROP NOT NULL;
ALTER TABLE "subjects" ALTER COLUMN "address" DROP NOT NULL;
