-- Sprint 2 / S2.4 — 2FA setup mandate.
--
-- Default false cho rows hiện tại (user cũ không bị buộc re-setup ngay).
-- Code chỉ enforce setup khi login đầu tiên + flag = true; admin có thể bật
-- bằng tay cho user cần force. User mới (qua admin create / signup nếu có)
-- mặc định bị buộc setup ở first login.

ALTER TABLE "users" ADD COLUMN "twoFaSetupRequired" BOOLEAN NOT NULL DEFAULT false;

-- Set default = true cho schema-level (Prisma generate đọc từ schema.prisma)
-- để user TƯƠNG LAI tự động required=true. Default existing data đã false ở dòng trên.
ALTER TABLE "users" ALTER COLUMN "twoFaSetupRequired" SET DEFAULT true;
