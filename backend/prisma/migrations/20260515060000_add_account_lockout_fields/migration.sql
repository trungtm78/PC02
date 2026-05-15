-- Sprint 1 / S1.2 — Account lockout fields.
--
-- failedLoginAttempts: counter increments mỗi lần fail password, reset về 0
--                       trên login success. Default 0 cho user hiện tại.
-- lockedUntil:        timestamp mở khoá. NULL = không lock.
-- lastFailedLoginAt:  timestamp lần fail gần nhất — phục vụ audit forensics.
--
-- Threshold + duration nằm trong code (auth-policy.constants.ts): 5 lần fail
-- liên tiếp → lock 15 phút. Locked user bị reject trước khi bcrypt.compare chạy.

ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);
