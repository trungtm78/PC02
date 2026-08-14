-- `otp_codes.purpose` — cột mã ĐANG ghi mà không migration nào tạo.
--
-- `20260423000001_add_2fa_fields` tạo bảng `otp_codes` KHÔNG có cột này, và
-- không migration nào thêm sau đó. Nhưng `otp-code.service.ts` ghi `purpose`
-- mỗi lần sinh OTP và truy vấn theo nó khi vô hiệu hoá mã cũ.
--
-- Hệ quả trên DB dựng bằng `migrate deploy` (máy mới, CI, VM dựng theo
-- docs/DEPLOY.md): MỌI lần sinh OTP đều lỗi "column purpose does not exist" ⇒
-- 2FA và đặt lại mật khẩu hỏng hoàn toàn ⇒ người dùng bật 2FA KHÔNG đăng nhập
-- được. Không phải suy giảm nhẹ — là mất đường vào hệ thống.
--
-- Vì sao chưa ai gặp: DB đang chạy dựng bằng `prisma db push` (áp thẳng schema)
-- nên CÓ cột. Chỉ DB dựng từ lịch sử migration mới thiếu — mà cho tới ND-26 thì
-- không ai dựng nổi một DB như vậy.
--
-- `IF NOT EXISTS` để chạy được cả trên DB đã có cột sẵn (mọi DB dựng bằng
-- `db push`), không cần ai phải phân biệt trước khi deploy.
ALTER TABLE "otp_codes"
  ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'TWO_FA';
