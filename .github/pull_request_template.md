## Changes
<!-- Mô tả ngắn gọn thay đổi trong PR này -->

## CI Status
- [ ] Jest tests pass (`cd backend && npm test`)
- [ ] No new TypeScript errors

## UAT Gate (bắt buộc trước khi merge to main)

**Staging URL:** <!-- e.g. https://pc02-pr-42.onrender.com. Nếu chưa có Render Preview: dùng localhost:3000 CHỈ khi đây là hotfix/non-production-impacting change. Ghi rõ "pre-staging" trong PR. -->
**Commit SHA tested:**
**Officer UAT Approver:** <!-- Họ tên / Chức vụ / Đơn vị -->
**Date/time:** <!-- e.g. 2026-04-25 14:30 ICT -->

### Scenarios

- [ ] BAC-001: Tạo hồ sơ mới — trạng thái + audit log đúng
- [ ] BAC-002: Cập nhật hồ sơ — dữ liệu tồn tại sau reload
- [ ] BAC-003: Chuyển trạng thái hợp lệ TT28 (Tiếp nhận → Xác minh)
- [ ] BAC-004: Block chuyển trạng thái không hợp lệ
- [ ] BAC-005: DeadlineBadge đúng màu (đỏ/vàng/xanh)
- [ ] BAC-006: KPI dashboard số đúng (Thụ lý tăng +1 sau tạo hồ sơ)
- [ ] BAC-007: Concurrency — không overwrite silently (DEFERRED nếu chưa có Optimistic Locking — ghi "DEFERRED — TODOS CONC-001")
- [ ] BAC-009: Đơn thư — STT tự sinh đúng định dạng DT-YYYY-NNNNN
- [ ] BAC-010: Vụ việc — deadline tự tính đúng theo BLTTHS
- [ ] BAC-011: DataScope — Điều tra viên không thấy hồ sơ/đơn thư/vụ việc ngoài tổ

### Kết quả

**PASS / FAIL**

<!-- Nếu FAIL: liệt kê scenario bị fail, mô tả behavior thực tế vs expected, Blocking? yes/no -->

### Sign-off

| | |
|---|---|
| **Họ tên** | |
| **Chức vụ** | |
| **Ngày giờ** | |

Tôi xác nhận đã thực thi các scenario UAT trên staging với commit trên và approve merge to main.
