/**
 * Auth policy constants — Sprint 1 / S1.2 account lockout.
 *
 * MAX_FAILED_LOGIN_ATTEMPTS: số lần fail liên tiếp cho phép trước khi lock.
 * LOCKOUT_DURATION_MS:        thời lượng lock (ms) — 15 phút theo plan public launch.
 *
 * NIST SP 800-63B khuyến nghị tối thiểu 10 fail attempts; em chọn 5 cho hệ thống
 * nội bộ + soon-public PC02 vì attack surface nhỏ và user count thấp — đổi ở đây.
 */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 phút
