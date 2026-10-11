# RUNBOOK — Báo cáo động (Dynamic Report Builder)

Theo spec §6.1 PR10: "Runbook: rollback (tắt flag, giữ dữ liệu), backup + thử restore." Tài liệu này ghi lại cách vận hành thật và bằng chứng đã kiểm thật trên dev local (Postgres 18 @127.0.0.1:5433), không phải suy diễn trên giấy.

## 1. Rollback — tắt flag, giữ dữ liệu

### 1.1 Cơ chế

Flag `dynamic_reports` sống trong bảng `feature_flags` (đọc bởi `FeatureFlagsService`, cache TTL 30s — xem `backend/src/feature-flags/feature-flags.service.ts`). Chưa có route admin API để tắt/mở flag qua HTTP (chỉ có `GET /feature-flags` đọc; `FeatureFlagsService.setEnabled()` hiện chỉ được gọi từ test) — cách tắt duy nhất hiện tại là UPDATE trực tiếp trên DB, đúng như đã làm thật một lần trong sự cố "BẬT ngầm sau deploy" (xem mục Nợ kỹ thuật trong `PROGRESS.md`, đã vá 10/10/2026 22:20 UTC).

### 1.2 Lệnh tắt (production)

```sql
UPDATE feature_flags SET enabled = false, "updatedAt" = now() WHERE key = 'dynamic_reports';
```

Chạy qua `sudo -u postgres psql -d pc02_case_mgmt -c "..."` trên VM. **Không cần restart backend** — cache tự làm mới trong vòng 30 giây (`CACHE_TTL_MS`). Để có hiệu lực ngay, khởi động lại service (`systemctl restart pc02-backend`) sẽ xoá cache cũ.

### 1.3 Mở lại (sau khi khắc phục)

```sql
UPDATE feature_flags SET enabled = true, "updatedAt" = now() WHERE key = 'dynamic_reports';
```

### 1.4 Vì sao an toàn — "giữ dữ liệu"

`@FeatureFlag('dynamic_reports')` (guard ở mọi controller của module — `ClockController`, `ReportsController`, `TemplatesController`, `ReportConfigController`, `SubmissionController`, `AggregateController`, `ExportController`, `StatusQueryController`) chỉ chặn ở **tầng request-time**, trước khi vào handler. Tắt flag:
- Chặn mọi request MỚI vào module (trả lỗi route-không-tồn-tại/403, tuỳ guard chain).
- **Không đụng tới bất kỳ bảng `dyn_report_*` nào** — không migration, không xoá, không archive. Mọi `DynReport`/`DynReportVersion`/`DynReportSubmission`/`DynReportRevision` đã có giữ nguyên.
- Request đang chạy giữa đường (ví dụ một transaction SAVE đang commit) không bị cắt nửa chừng — flag chỉ kiểm tra lúc route vào, không có polling giữa transaction.
- Mở lại flag → mọi dữ liệu, lịch sử revision, trạng thái kỳ/bản nộp hiện ra lại NGUYÊN VẸN, không cần khôi phục gì.

Đây khác hẳn rollback code (quay lại release trước — xem `docs/DEPLOY.md` mục Rollback của repo chính): rollback flag KHÔNG cần CI/CD, có hiệu lực trong ≤30 giây, và không rủi ro mất dữ liệu ghi sau lần deploy gần nhất (vì không đụng DB).

## 2. Backup + thử restore — ĐÃ KIỂM THẬT (không suy diễn)

### 2.1 Backup có sẵn (production)

Theo `docs/DEPLOY.md` (repo chính): mọi lần deploy tự chạy `pg_dump` trước khi áp migration mới, lưu tại `/var/backups/pc02/pre-deploy-<SHA>-<date>.sql.gz`. File này chứa **TOÀN BỘ** DB `pc02_case_mgmt`, bao gồm mọi bảng `dyn_report_*` — không cần cơ chế backup riêng cho module này.

### 2.2 Thử restore thật — đã chạy trên dev, 11/10/2026

Không chỉ đọc tài liệu — đã tự chạy một vòng backup→restore→đối chiếu thật trên `pc02_dynamic_reports_test`:

```bash
# 1. Backup thật (custom format, giống cơ chế prod)
pg_dump -h 127.0.0.1 -p 5433 -U postgres -Fc -f backup-test.dump pc02_dynamic_reports_test
# → 617.7 KB

# 2. Tạo DB sạch để thử restore (không đụng DB đang chạy)
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "CREATE DATABASE pc02_dr_restore_check;"

# 3. Restore thật
pg_restore -h 127.0.0.1 -p 5433 -U postgres -d pc02_dr_restore_check backup-test.dump
# → chạy sạch, 0 lỗi

# 4. Đối chiếu số dòng dyn_report_* giữa DB gốc và DB vừa restore
SELECT (SELECT count(*) FROM dyn_reports) reports,
       (SELECT count(*) FROM dyn_report_submissions) submissions,
       (SELECT count(*) FROM dyn_report_revisions) revisions;
# DB gốc:     1 report | 2 submissions | 9 revisions
# DB restore: 1 report | 2 submissions | 9 revisions   ← KHỚP CHÍNH XÁC

# 5. Đối chiếu nội dung thật một dòng (không chỉ số lượng)
SELECT id, code, status FROM dyn_reports;
# Cả 2 DB: dr-test-report-1 | DR-TEST-01 | PUBLISHED    ← KHỚP CHÍNH XÁC

# 6. Dọn dẹp
DROP DATABASE pc02_dr_restore_check;
rm backup-test.dump
```

**Kết luận**: chu trình backup (`pg_dump -Fc`) → restore (`pg_restore`) hoạt động đúng cho dữ liệu của module này, không cần xử lý đặc biệt gì (không có large object, không có extension riêng cho `dyn_report_*`).

### 2.3 Khôi phục trên production (khi cần)

```bash
# Trên VM, sau khi xác định bản backup đúng cần khôi phục:
sudo -u postgres pg_restore -d pc02_case_mgmt -c \
  /var/backups/pc02/pre-deploy-<SHA>-<date>.sql.gz
```

`-c` (clean) xoá object cũ trước khi tạo lại — khôi phục TOÀN BỘ DB về đúng trạng thái tại thời điểm backup, bao gồm mọi module khác, không chỉ `dyn_report_*`. Đây là cùng lệnh đã ghi ở `docs/DEPLOY.md` mục "DB migration rollback" của repo chính — module này không cần một đường khôi phục riêng.

## 3. Khi nào dùng cách nào

| Tình huống | Hành động |
|---|---|
| Bug mới phát hiện ở module, cần chặn người dùng ngay trong lúc vá | **Tắt flag** (§1.2) — ≤30s có hiệu lực, không mất dữ liệu, không cần deploy |
| Bug do code mới deploy gây ra, cần quay lại bản trước | **Rollback code** (`docs/DEPLOY.md` mục Rollback repo chính) — ~1 phút, không mất data nếu không có migration mới giữa 2 bản |
| Migration mới làm sai dữ liệu | **DB restore** từ `pre-deploy-<SHA>.sql.gz` — chỉ dùng khi migration đã THỰC SỰ làm hỏng dữ liệu, vì sẽ mất mọi ghi nhận sau thời điểm backup |
| Cả pipeline CI/CD hỏng | **Catastrophic rollback** (`docs/DEPLOY.md`) |

Flag `dynamic_reports` **vẫn ĐANG BẬT trên production** theo yêu cầu của anh (xem `PROGRESS.md`) — mục §1 ở trên là kịch bản dự phòng, chưa cần dùng tới.
