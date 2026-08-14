# PC02 Deploy Guide

Pipeline: **GitHub Actions → Viettel Cloud VM (171.244.40.245)**.

## How deploys work

| Trigger | Effect |
|---|---|
| Push to `main` | Auto build + deploy to VM |
| Push tag `v*` (vd `v0.15.1.0`) | Auto build + deploy + create GitHub Release |
| `workflow_dispatch` (Actions UI) | Manual deploy on any branch (test) |

Pipeline luôn chạy 3 jobs theo thứ tự: `test` → `build` → `deploy`. Deploy job được gate bởi GitHub Environment `production` (có thể bật approval gate sau).

## VM layout

```
/home/pc02/
├── bin/                        # deploy scripts (installed bởi migrate-existing.sh)
│   ├── deploy.sh
│   ├── health-check.sh
│   └── rollback.sh
├── releases/
│   ├── <sha1>/                 # release older
│   ├── <sha2>/
│   └── <sha-current>/          # release hiện tại
├── current → releases/<sha-current>   (symlink)
└── shared/                     # persisted across deploys
    ├── .env                    # backend env (mode 600)
    ├── keys/                   # JWT RSA keys
    └── uploads/                # user uploads
```

Backend systemd unit chạy từ `/home/pc02/current/backend/` (theo symlink).

## GitHub Secrets cần config

`Settings → Secrets and variables → Actions`:

| Secret | Value |
|---|---|
| `VM_HOST` | `171.244.40.245` |
| `VM_PORT` | `22` |
| `VM_USER` | `pc02` |
| `VM_SSH_PRIVATE_KEY` | Private key full PEM (`-----BEGIN OPENSSH PRIVATE KEY-----` ... `-----END OPENSSH PRIVATE KEY-----`) |

Public key tương ứng phải được paste vào `/home/pc02/.ssh/authorized_keys` trên VM.

## Baseline migration (ND-26)

Lịch sử migration mở đầu bằng `ALTER TABLE "cases"` mà **không migration nào tạo
bảng `cases`** — toàn bộ 93 migration được commit một lượt trong initial commit,
schema trước đó chỉ tồn tại trong DB dựng bằng `prisma db push` và chưa từng vào
git. Hậu quả: `prisma migrate deploy` **không dựng nổi DB trắng**, migration đầu
tiên chết ngay với `relation "cases" does not exist`.

`prisma/migrations/00000000000000_baseline/` vá đúng chỗ đó. Đã kiểm chứng: DB
trắng → `migrate deploy` → **94/94 migration áp dụng sạch**.

**Với DB đang chạy (prod, dev, hoặc bất kỳ DB nào đã có dữ liệu)** — chạy MỘT
LẦN, trước lần deploy đầu tiên sau khi merge:

```bash
cd /home/pc02/current/backend
npx prisma migrate resolve --applied 00000000000000_baseline
```

Lệnh này chỉ **ghi thêm một dòng** vào `_prisma_migrations`; nó không chạy SQL
nào và không đụng dữ liệu. Bỏ qua bước này thì lần `migrate deploy` kế tiếp sẽ
cố chạy baseline trên DB đã có sẵn bảng và **fail**.

> **Drift còn lại — đã quy trách nhiệm đủ 46/46.** So schema dựng-từ-migration
> với `schema.prisma` còn **46 câu lệnh** khác biệt. Đã soát từng câu:
> **tất cả 46 đều do migration, không câu nào do baseline.** Đây đúng là drift
> có sẵn mà [ADR-0011](adr/0011-partial-index-drift-is-accepted.md) đã chấp
> nhận, nay lần đầu đo được thành con số.
>
> Tập trung ở vài chỗ: `deadline_rule_versions` (9 câu — khoá ngoại khai
> `SET NULL` trong schema mà migration tạo bằng `RESTRICT`), `incidents` (7),
> ~~`NotificationType` (4 giá trị)~~ — **ĐÃ SỬA**, xem dưới,
> `edit_window_reset_requests` (2 — migration đặt tên index ngắn `ewrr_*`,
> schema muốn tên mặc định của Prisma). `otp_codes` được migration tạo mà thiếu
> hẳn cột `purpose`.
>
> **Cách kiểm lại bất cứ lúc nào:** dựng DB trắng → `migrate deploy` →
> `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
> --script`. Lưu ý khi so bằng script: banner "Update available" của Prisma CLI
> lẫn vào stdout, đừng đếm nhầm thành câu lệnh SQL.
>
> **Một mục trong danh sách drift hoá ra là BUG THẬT, không phải drift chấp nhận
> được.** `NotificationType` thiếu 4 giá trị (`CASE_OVERDUE`, `PETITION_OVERDUE`,
> `INCIDENT_DEADLINE_NEAR`, `INCIDENT_OVERDUE`) mà `deadline.scheduler.ts` **đang
> phát mỗi ngày lúc 7:00**. Trên DB dựng từ lịch sử migration — tức mọi máy mới,
> CI, hoặc VM dựng theo tài liệu này — mỗi lần scheduler chạy là một lỗi enum
> Postgres, và người vận hành chỉ thấy nó im lặng hỏng.
>
> Vì sao chưa ai gặp: DB đang chạy được dựng bằng `prisma db push` (áp thẳng
> schema) nên CÓ đủ giá trị. Chỉ DB dựng từ migration mới thiếu — mà cho tới
> ND-26 thì **không ai dựng nổi một DB như vậy**. Baseline vừa mở đường dựng DB
> trắng thì lỗi này lộ ra ngay.
>
> Đã sửa: `20260814000000_notification_type_missing_values`. Drift 46 → 43 câu.
>
> Baseline làm phép đo này **lần đầu tiên chạy được** — trước đó
> `migrate diff --from-migrations` chết ngay từ migration thứ nhất, đó chính là
> lý do `Advisory Checks` known-red.

## First-time setup checklist

### Trên VM (làm 1 lần)

1. SCP `scripts/deploy/migrate-existing.sh` lên VM
2. Chạy:
   ```bash
   sudo bash migrate-existing.sh
   ```
3. Verify health: `curl http://localhost:3000/api/v1/health` → `{"status":"ok",...}`
4. Add CI/CD public key vào `/home/pc02/.ssh/authorized_keys`
5. Update sudoers cho user `pc02` (`/etc/sudoers.d/pc02`):
   ```
   pc02 ALL=(ALL) NOPASSWD: /bin/systemctl restart pc02-backend, /bin/systemctl reload nginx, /bin/cp, /bin/chown
   ```

### Trên GitHub

1. Add 4 secrets ở bảng trên
2. (Optional) Setup environment `production` với approval gate nếu muốn
3. Test bằng `workflow_dispatch` trước khi merge

## Daily workflow

```bash
# Local
git checkout -b feat/something
# code, commit, push
gh pr create

# Sau khi PR merge to main:
# → GitHub Actions auto-deploys to VM
# → Watch progress at Actions tab

# Release production:
git tag v0.15.1.0
git push --tags
# → Deploys + creates GitHub Release with CHANGELOG section
```

## Rollback

### Code rollback (1 phút, không mất data)

SSH vào VM:

```bash
ssh pc02@171.244.40.245

# List available releases
bash /home/pc02/bin/rollback.sh --list

# Rollback to immediately previous release
bash /home/pc02/bin/rollback.sh

# Rollback to specific release
bash /home/pc02/bin/rollback.sh <SHA>
```

Script tự:
1. Switch symlink `current` về release đích
2. Copy frontend dist
3. Restart `pc02-backend`
4. Health check

### DB migration rollback

Prisma không hỗ trợ auto down migration. Restore từ pre-deploy backup:

```bash
ls -lt /var/backups/pc02/pre-deploy-*.sql.gz | head -5
# Pick the one tagged with the SHA you want to revert TO

sudo -u postgres pg_restore -d pc02_case_mgmt -c \
    /var/backups/pc02/pre-deploy-<SHA>-<date>.sql.gz
```

`-c` flag = drop existing objects before restore.

### Catastrophic rollback (CI/CD pipeline hỏng hoàn toàn)

Restore pre-CI/CD snapshot:

```bash
sudo tar xzf /var/backups/pc02/pre-cicd-migration-*.tar.gz -C /home/pc02/
# Resets to old /home/pc02/app/ layout
# Revert systemd unit từ .bak:
sudo cp /etc/systemd/system/pc02-backend.service.bak /etc/systemd/system/pc02-backend.service
sudo systemctl daemon-reload && sudo systemctl restart pc02-backend
```

## Observability

### Deploy logs
- GitHub Actions tab: full pipeline log với từng job
- VM: `sudo journalctl -u pc02-backend -f` để xem backend logs realtime
- VM: `tail -f /var/log/pc02-backup.log` để xem cron backup logs

### Disk usage
- `du -sh /home/pc02/releases/*` — xem dung lượng các release
- Script tự prune giữ 5 releases gần nhất

### Health endpoint
- Internal: `http://localhost:3000/api/v1/health`
- External: `http://171.244.40.245/api/v1/health` (qua nginx)
- Response: `{"status":"ok","timestamp":"<ISO>"}`

## Troubleshooting

### "Permission denied (publickey)" trong GitHub Actions

→ Public key chưa được paste vào VM, hoặc paste sai. Verify:

```bash
ssh pc02@171.244.40.245 "cat ~/.ssh/authorized_keys" | grep github-actions
```

### Migration fail

→ `deploy.sh` STOP trước khi switch symlink. Backend cũ vẫn chạy.
1. Đọc log: GitHub Actions → Deploy job
2. SSH vào VM: `cat /home/pc02/releases/<failed-sha>/.last_migrate_output` (nếu có)
3. Fix migration (rollback migration thủ công nếu cần)
4. Push commit fix → tự retry deploy

### Health check fail sau khi switch

→ Backend restart nhưng không healthy. Auto-rollback KHÔNG xảy ra (cần manual):

```bash
ssh pc02@171.244.40.245 "bash /home/pc02/bin/rollback.sh"
```

### Disk đầy

```bash
ssh pc02@171.244.40.245 "df -h /home"
# Nếu >80%, prune thêm:
ssh pc02@171.244.40.245 "ls -1dt /home/pc02/releases/*/ | tail -n +3 | xargs rm -rf"
# (Giữ lại current + 1 previous)
```

## Security notes

- Private SSH key chỉ tồn tại trong GitHub Secrets (encrypted at rest, không log)
- `webfactory/ssh-agent` chạy key in-memory chỉ trong job duration
- VM authorized_keys giới hạn theo IP của GitHub Actions runners (Microsoft Azure) — không cần thêm restriction
- Sau khi key compromise: generate keypair mới, paste vào VM, update GitHub Secret, revoke old key

### `ALLOW_SEED_ENDPOINTS` — để TẮT trên production

Bốn endpoint nạp dữ liệu mẫu (`POST /directories/seed`, `/notifications/seed`,
`/settings/seed`, `/address-mappings/seed/:province`) chỉ dùng cho cài đặt lần
đầu. Chúng ghi hàng loạt, có cái chạy lâu, và `/settings/seed` **ghi đè cấu hình**
mà nhiều chỗ khác đang đọc.

`SeedEndpointGuard` yêu cầu **đồng thời** hai điều kiện:

1. `ALLOW_SEED_ENDPOINTS=true` trong môi trường, và
2. người gọi có vai trò `ADMIN`.

Biến này **không đặt** trên production, nên cả bốn endpoint trả 403 bất kể ai
gọi. Chỉ bật tạm khi dựng máy mới, xong thì bỏ đi và restart service.

Chỉ so khớp đúng chuỗi `'true'` — `1`, `yes`, `TRUE` đều bị coi là tắt, để một
dòng `.env` viết vội không vô tình mở cổng.

`POST /address-mappings/seed/:id/cancel` **không** bị gate: hủy một job đang chạy
phải luôn gọi được bởi người nhìn thấy nó treo.
