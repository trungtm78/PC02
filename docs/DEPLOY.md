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
