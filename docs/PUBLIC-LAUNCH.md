# PC02 — Public Internet Launch Guide

**Mục tiêu:** chuyển hệ thống PC02 từ internal VPN (HTTP) sang public Internet (HTTPS + hardened).

**Phạm vi guide này:** Sprint 1 only — TLS, nginx hardening, account lockout, throttle.
Sprint 2 (audit + 2FA mandate) và Sprint 3 (session registry + monitoring) sẽ có guide riêng.

---

## 0. Pre-flight checklist

- [ ] Domain đã trỏ A record về `171.244.40.245` (verify: `dig +short <domain>`).
- [ ] Có SSH root/sudo access vào VM Viettel.
- [ ] Đã merge PR Sprint 1 vào main và auto-deploy thành công (`gh run list --branch main --limit 1` phải có conclusion=success).
- [ ] Backend health endpoint trả 200 trên HTTP nội bộ: `curl http://127.0.0.1:3000/api/v1/health` từ trên VM.

---

## 1. Cấp Let's Encrypt cert

SSH vào VM:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# ACME HTTP-01 challenge cần port 80 mở
sudo certbot --nginx -d <domain> --non-interactive --agree-tos -m admin@<domain> --redirect
```

Verify cert:
```bash
sudo certbot certificates
# Expect: Certificate Path: /etc/letsencrypt/live/<domain>/fullchain.pem
```

Verify auto-renew (Let's Encrypt cert sống 90 ngày, certbot tự renew ở 60 ngày):
```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
# Expect: "Congratulations, all simulated renewals succeeded"
```

---

## 2. Install nginx golden config

Từ máy dev (Windows / WSL / Mac), copy file lên VM:

```bash
scp scripts/deploy/nginx-pc02.conf pc02vm:~/
scp scripts/deploy/install-nginx-config.sh pc02vm:~/
```

SSH vào VM và chạy:

```bash
ssh pc02vm
chmod +x ~/install-nginx-config.sh
sudo ~/install-nginx-config.sh <domain>
```

Script sẽ:
1. Backup config nginx hiện tại sang `/var/backups/pc02-nginx/`.
2. Render template với domain thực thay cho `__DOMAIN__`.
3. Cài vào `/etc/nginx/sites-available/pc02` + symlink sang `sites-enabled/`.
4. Vô hiệu hoá site default nếu còn.
5. `nginx -t` validate.
6. `systemctl reload nginx`.
7. Curl test health endpoint.

Nếu `nginx -t` fail → script abort, config cũ vẫn active. Backup ở `$BACKUP_FILE` để anh rollback thủ công.

---

## 3. Apply migration account lockout

Migration tự động chạy khi deploy.yml chạy `prisma migrate deploy` trên VM. Verify:

```bash
ssh pc02vm
cd /home/pc02/current/backend
npx prisma migrate status
# Expect: "Database schema is up to date!" với 20260515060000_add_account_lockout_fields trong applied list
```

Nếu chưa apply:
```bash
sudo -u pc02 npx prisma migrate deploy
sudo systemctl restart pc02-backend
```

---

## 4. Verification — Acceptance tests

### 4.1 TLS + Security headers

```bash
# Từ máy ngoài VM:
curl -I https://<domain>/api/v1/health
# Expect tất cả:
#   HTTP/2 200
#   strict-transport-security: max-age=31536000; includeSubDomains; preload
#   x-content-type-options: nosniff
#   x-frame-options: DENY
#   referrer-policy: strict-origin-when-cross-origin
#   content-security-policy: default-src 'self'; ...

curl -I http://<domain>/
# Expect: HTTP/1.1 301 Moved Permanently + Location: https://<domain>/
```

### 4.2 SSL Labs + securityheaders.com

Open trên browser:
- https://www.ssllabs.com/ssltest/analyze.html?d=<domain> → **A** grade
- https://securityheaders.com/?q=<domain> → **A+** rating

### 4.3 Account lockout

```bash
# Test 5 fail liên tiếp → lock 15 phút
for i in 1 2 3 4 5; do
  curl -X POST https://<domain>/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"<test_user>","password":"WRONG"}' \
    -w "Attempt $i: %{http_code}\n" -o /dev/null -s
done
# Expect: 401 cho 5 fail đầu, fail thứ 6 với password đúng vẫn → 401 với message "khoá tạm thời"

# Verify trong DB
psql -U pc02_admin -d pc02_db -c "SELECT email, \"failedLoginAttempts\", \"lockedUntil\" FROM users WHERE email='<test_user>';"
# Expect: failedLoginAttempts=5, lockedUntil > NOW()

# Verify audit log
psql -U pc02_admin -d pc02_db -c "SELECT action, \"createdAt\" FROM audit_logs WHERE \"userId\"=(SELECT id FROM users WHERE email='<test_user>') ORDER BY \"createdAt\" DESC LIMIT 3;"
# Expect: USER_LOGIN_LOCKED, USER_LOGIN_FAILED × N
```

### 4.4 Rate limit nginx

```bash
# 12 request liên tiếp đến /api/v1/health
for i in $(seq 1 12); do
  curl -o /dev/null -s -w "%{http_code} " https://<domain>/api/v1/health
done; echo
# Expect: vài 200 đầu, sau đó 503 (limit_req zone=pc02_api rate=10r/s burst=20)
```

### 4.5 File upload throttle

```bash
# Yêu cầu test user đã login + có access token
TOKEN="<access_token>"
for i in $(seq 1 12); do
  curl -X POST https://<domain>/api/v1/documents \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@./small.pdf" \
    -F "title=Test $i" \
    -w "Upload $i: %{http_code}\n" -o /dev/null -s
done
# Expect: 201/200 cho 10 đầu, request 11 trở đi → 429 Too Many Requests
```

### 4.6 Request size cap

```bash
# Tạo file 30MB
dd if=/dev/urandom of=/tmp/big.bin bs=1M count=30
curl -X POST https://<domain>/api/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/big.bin" \
  -w "%{http_code}\n" -o /dev/null -s
# Expect: 413 Request Entity Too Large (từ nginx, trước khi vào backend)
```

---

## 5. Post-launch rotation tasks (urgent)

**Anh làm tay sau khi TLS lên:**

1. **Rotate password `admin@pc02.local`**:
   - Login với password cũ (lần CUỐI CÙNG plaintext qua mạng — nhưng sau khi TLS lên thì sang HTTPS rồi).
   - Đổi password mới qua UI `/auth/change-password`.
   - Verify: login với password cũ → 401.

2. **(Optional) Scrub password cũ khỏi git history**:
   ```bash
   git clone --mirror git@github.com:trungtm78/PC02.git pc02-mirror
   cd pc02-mirror
   # Cài git-filter-repo: pip install git-filter-repo
   echo '8buYJnZqMFUv3jWsdMaGvd5b==>***REDACTED***' > /tmp/redact.txt
   git filter-repo --replace-text /tmp/redact.txt
   git push --force --all
   ```
   ⚠ Force-push history rewrite: tất cả collaborator/CI cache phải re-clone.
   Nếu chỉ anh tự dùng repo thì OK. Nếu nhiều người dùng thì coordinate.

---

## 6. Rollback procedure

Nếu sau khi cài config có vấn đề:

```bash
# Khôi phục nginx config cũ
sudo cp /var/backups/pc02-nginx/pc02-<timestamp>.conf.bak /etc/nginx/sites-available/pc02
sudo nginx -t && sudo systemctl reload nginx

# Khôi phục cert nếu certbot phá hỏng
sudo certbot delete --cert-name <domain>
sudo systemctl reload nginx
```

Backend rollback (account lockout migration) — nếu cần revert:

```bash
# CHỈ làm khi thật sự cần. Migration drop column = data loss cho counter.
psql -U pc02_admin -d pc02_db -c '
ALTER TABLE users DROP COLUMN "failedLoginAttempts";
ALTER TABLE users DROP COLUMN "lockedUntil";
ALTER TABLE users DROP COLUMN "lastFailedLoginAt";
DELETE FROM _prisma_migrations WHERE migration_name = '"'"'20260515060000_add_account_lockout_fields'"'"';
'
sudo systemctl restart pc02-backend
```

Sau khi revert thì redeploy code cũ (pre-Sprint-1 commit).

---

## 7. Known gaps after Sprint 1

Những thứ Sprint 1 chưa giải quyết — cần Sprint 2 + 3:

- **Audit log chưa cover file download + data export** → Sprint 2.
- **2FA chưa bắt buộc toàn user** → Sprint 2.
- **Backend logout endpoint chưa có** → Sprint 2.
- **Session/device registry chưa có** → Sprint 3.
- **Monitoring/alerting chưa có** → Sprint 3.
- **Off-site backup chưa có** → Sprint 3.

Reference: `~/.claude/plans/gi-th-nh-gi-binary-globe.md` — full 3-sprint plan.
