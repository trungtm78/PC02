-- `NotificationType` thiếu 4 giá trị mà mã ĐANG dùng.
--
-- Bốn giá trị dưới đây có trong `schema.prisma` nhưng KHÔNG migration nào thêm.
-- Trên DB dựng bằng `prisma migrate deploy` (máy mới, CI, hoặc VM mới theo
-- docs/DEPLOY.md) chúng không tồn tại — trong khi `deadline.scheduler.ts` phát
-- `CASE_OVERDUE` và `INCIDENT_DEADLINE_NEAR` mỗi ngày lúc 7:00. Mỗi lần chạy là
-- một lỗi enum của Postgres, và người vận hành chỉ thấy scheduler im lặng hỏng.
--
-- Vì sao trước nay không ai gặp: DB đang chạy được dựng bằng `prisma db push`
-- (áp thẳng schema), nên nó CÓ đủ giá trị. Chỉ DB dựng từ lịch sử migration mới
-- thiếu — mà cho tới ND-26 thì không ai dựng nổi DB như vậy.
--
-- ADR-0010: `ALTER TYPE ADD VALUE` là MỘT CHIỀU, không rollback được. Migration
-- này vì thế ở MỘT MÌNH MỘT FILE và KHÔNG backfill dùng giá trị mới trong cùng
-- transaction — dùng ngay trong transaction vừa thêm là lỗi Postgres.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CASE_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PETITION_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCIDENT_DEADLINE_NEAR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INCIDENT_OVERDUE';
