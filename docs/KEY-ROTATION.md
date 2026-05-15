# PC02 — Key Rotation Procedures

**Sprint 3 / S3.5.** Runbook cho 3 loại key. Hiện tại không có lịch rotation định kỳ — chỉ rotate khi nghi compromise hoặc developer rời team. Trong tương lai (>6 tháng public) nên rotate JWT key mỗi 6 tháng.

## 1. JWT signing key (RS256 keypair)

**Khi rotate**:
- Nghi private key leaked.
- Developer access VM rời team.
- Lịch định kỳ 6 tháng (khuyến nghị).

**Impact**: ALL active sessions invalidate. Mọi user phải login lại.

**Procedure**:

```bash
ssh pc02vm

# 1. Generate keypair mới
cd /home/pc02/shared/keys
openssl genrsa -out private-new.pem 4096
openssl rsa -in private-new.pem -pubout -out public-new.pem
chmod 600 private-new.pem
chmod 644 public-new.pem

# 2. (Tuỳ chọn) Bump tokenVersion all users trước để force re-login
# Đây là "soft rotation" — user login lại với key cũ vẫn fail vì tokenVersion check.
sudo -u postgres psql pc02_db -c "UPDATE users SET \"tokenVersion\" = \"tokenVersion\" + 1;"

# 3. Backup keys cũ
cp private.pem private-old-$(date +%Y%m%d).pem
cp public.pem public-old-$(date +%Y%m%d).pem

# 4. Atomic swap
mv private-new.pem private.pem
mv public-new.pem public.pem

# 5. Restart backend
sudo systemctl restart pc02-backend

# 6. Verify health
curl -sf https://<domain>/api/v1/health
```

**Rollback**: copy `private-old-<date>.pem` → `private.pem` (and public similarly), restart backend.

## 2. TOTP encryption key

`TotpEncryptionService` mã hoá `User.totpSecret` bằng AES-256-GCM với key từ env `TOTP_ENCRYPTION_KEY`. Rotation nguy hiểm vì tất cả TOTP secret hiện encrypt với key cũ.

**Khi rotate**: nghi env leaked.

**Impact** nếu làm sai: ALL user mất 2FA, phải re-setup TOTP.

**Procedure** (dual-write transition — chưa implement, chỉ ghi guide):

```
TODO: implement dual-write logic trong TotpEncryptionService:
  - encrypt() dùng key mới
  - decrypt() thử key mới TRƯỚC, fallback key cũ nếu fail
  - Background job re-encrypt tất cả rows với key mới
  - Sau khi 100% rows migrate xong, drop key cũ
```

**Workaround tạm** (nếu cần rotate gấp): admin reset 2FA cho TẤT CẢ user qua bulk SQL:
```sql
UPDATE users SET "totpSecret" = NULL, "totpEnabled" = false,
  "totpSetupPending" = false, "backupCodes" = '{}',
  "backupCodeSalts" = '{}', "twoFaSetupRequired" = true;
```
Sau đó đổi `TOTP_ENCRYPTION_KEY` env + restart backend. User login → bị force re-setup TOTP.

## 3. SMTP password

Env var `SMTP_PASS`. Đổi đơn giản:

```bash
ssh pc02vm
sudo nano /home/pc02/shared/.env
# Sửa SMTP_PASS=<new_password>
sudo systemctl restart pc02-backend

# Verify
sudo journalctl -u pc02-backend --since "1 minute ago" | grep -i smtp
```

## 4. Database password

Env var `DB_PASSWORD` (hoặc `DATABASE_URL` chứa password).

```bash
ssh pc02vm

# 1. Đổi password trong Postgres
sudo -u postgres psql -c "ALTER USER pc02_admin WITH PASSWORD '<new_password>';"

# 2. Update env
sudo nano /home/pc02/shared/.env
# Sửa DATABASE_URL hoặc DB_PASSWORD

# 3. Restart backend
sudo systemctl restart pc02-backend

# 4. Verify connect
sudo systemctl status pc02-backend
curl -sf https://<domain>/api/v1/health
```

## 5. GitHub Actions secrets

Rotate trong GitHub UI:
- Settings → Secrets and variables → Actions → tên secret → Update.

Secrets hiện tại: `VM_HOST`, `VM_PORT`, `VM_USER`, `VM_SSH_PRIVATE_KEY` (sau khi rotate cần cập nhật `~/.ssh/authorized_keys` trên VM tương ứng).
