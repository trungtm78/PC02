# PC02 — Off-site Backup Setup

**Sprint 3 / S3.2.** pg_dump backups hiện chỉ lưu cùng VM tại `/var/backups/pc02/`. Nếu VM crash hoặc bị compromise thì mất luôn. Sprint 3 thêm cron job đẩy backup lên Backblaze B2 (S3-compatible, $0.006/GB/tháng).

## Cost

| Data | Retention | Cost |
|---|---|---|
| 10GB backup × 30 day | 30 days | ~$2/tháng |
| 20GB backup × 30 day | 30 days | ~$4/tháng |

Free tier B2: 10GB storage + 1GB download/day → đủ cho PC02 ở giai đoạn đầu.

## Alternatives (nếu data sovereignty yêu cầu VN)

- **CMC Cloud Object Storage** (Hà Nội datacenter, S3-compatible)
- **Viettel Cloud Object Storage** (cùng provider VM hiện tại)
- **rsync sang VM thứ 2** (Conductor/dev server)

rclone hỗ trợ tất cả — chỉ đổi remote config trong `rclone config`.

## Setup 1 lần

### 1. Tạo Backblaze account + bucket

1. https://www.backblaze.com/sign-up — tạo account
2. Verify email + login
3. **Buckets** → Create Bucket:
   - Name: `pc02-backups-<random>` (B2 yêu cầu unique global)
   - Files in Bucket are: **Private**
   - Default Encryption: **Enable** (SSE-B2)
4. **Application Keys** → Add a New Application Key:
   - Name: `pc02-backup-cron`
   - Allow access to: chỉ bucket vừa tạo
   - Type of access: **Read and Write**
   - Copy `keyID` + `applicationKey` (chỉ hiện 1 lần!)

### 2. Cài rclone + cấu hình trên VM

```bash
ssh pc02vm
sudo apt update && sudo apt install -y rclone
rclone config
# Interactive prompts:
#   n) New remote
#   name> b2
#   Storage> 7  (Backblaze B2)
#   account> <paste keyID>
#   key>     <paste applicationKey>
#   hard_delete> false
#   q) Quit

# Test
rclone listremotes
# Expect: b2:
rclone lsd b2:
# Expect: pc02-backups-xxx
```

### 3. Cài backup script + cron

```bash
# Copy script
sudo cp /home/pc02/current/scripts/deploy/offsite-backup.sh /home/pc02/bin/
sudo chmod +x /home/pc02/bin/offsite-backup.sh

# Set env vars (nếu bucket name khác default)
echo 'PC02_BACKUP_BUCKET=pc02-backups-xxx' | sudo tee /etc/default/pc02-backup

# Cron job
sudo tee /etc/cron.d/pc02-backup <<EOF
# PC02 off-site backup — daily 03:00 (sau deploy.sh pre-deploy backup window)
0 3 * * * pc02 . /etc/default/pc02-backup && /home/pc02/bin/offsite-backup.sh >> /var/log/pc02-backup.log 2>&1
EOF

# Tạo log file với perms đúng
sudo touch /var/log/pc02-backup.log
sudo chown pc02:pc02 /var/log/pc02-backup.log
sudo chmod 640 /var/log/pc02-backup.log

# Test manual
sudo -u pc02 bash -c '. /etc/default/pc02-backup && /home/pc02/bin/offsite-backup.sh'
# Expect: "✓ Off-site backup completed successfully"
```

### 4. Verify Prometheus alert wire

Sau khi backup chạy lần đầu thành công, script ghi file `/var/lib/node_exporter/textfile_collector/pc02_offsite_backup.prom`. Node exporter scrape file này (cần cài + config textfile_collector path). Alert `OffsiteBackupStale` fires nếu >2 ngày không update.

```bash
sudo apt install prometheus-node-exporter
sudo mkdir -p /var/lib/node_exporter/textfile_collector
sudo chown -R node_exporter:node_exporter /var/lib/node_exporter
# Edit /etc/default/prometheus-node-exporter:
#   ARGS="--collector.textfile.directory=/var/lib/node_exporter/textfile_collector"
sudo systemctl restart prometheus-node-exporter
```

Cập nhật `scripts/monitoring/prometheus.yml` thêm node_exporter target nếu anh muốn.

## Recovery procedure

```bash
# 1. Pull backup từ B2 về VM (hoặc dev machine để test)
rclone copy b2:pc02-backups-xxx/2026-05-20/pre-deploy-<sha>-20260520_120000.sql.gz /tmp/

# 2. Decompress
gunzip /tmp/pre-deploy-<sha>-20260520_120000.sql.gz

# 3. Restore (DANGER — overwrites prod DB)
sudo -u postgres pg_restore -d pc02_db -c -v /tmp/pre-deploy-<sha>-20260520_120000.sql
# Hoặc dùng pg_restore --clean nếu format custom:
sudo -u postgres pg_restore -c -d pc02_db /tmp/pre-deploy-<sha>-20260520_120000.sql

# 4. Restart backend
sudo systemctl restart pc02-backend
```

## Test restore monthly

Schedule task: 1 lần/tháng pull backup mới nhất → restore vào dev DB → verify hot tables (users count, cases count) → log success. Em viết script này trong PR sau.
