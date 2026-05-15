#!/usr/bin/env bash
# Sprint 3 / S3.2 — Off-site backup script.
#
# Đẩy pg_dump backups từ /var/backups/pc02/ lên Backblaze B2 (hoặc S3-compatible).
# Run từ cron daily 03:00 sau khi deploy.sh ghi backup mới.
#
# Setup 1 lần:
#   sudo apt install -y rclone
#   rclone config  # tạo remote "b2": type=b2, account=<keyID>, key=<appKey>
#                  # bucket: pc02-backups (private, encryption enabled)
#
# Cron job (/etc/cron.d/pc02-backup):
#   0 3 * * * pc02 /home/pc02/bin/offsite-backup.sh >> /var/log/pc02-backup.log 2>&1
#
# Cost (Backblaze B2): ~$0.006/GB/month. 10GB × 30 day retention = ~$2/month.
#
# Recovery: rclone copy b2:pc02-backups/<date>/<file> /var/backups/pc02/
#          pg_restore -d pc02_db -c /var/backups/pc02/<file>

set -euo pipefail

REMOTE_NAME="${PC02_BACKUP_REMOTE:-b2}"
REMOTE_BUCKET="${PC02_BACKUP_BUCKET:-pc02-backups}"
LOCAL_BACKUP_DIR="/var/backups/pc02"
RETENTION_DAYS="${PC02_BACKUP_RETENTION_DAYS:-30}"
LOG_TAG="pc02-backup"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee >(logger -t "$LOG_TAG")
}

# Verify rclone available
if ! command -v rclone >/dev/null 2>&1; then
    log "ERROR: rclone not installed. apt install rclone."
    exit 1
fi

# Verify remote configured
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
    log "ERROR: rclone remote '${REMOTE_NAME}' chưa cấu hình. Run 'rclone config'."
    exit 1
fi

# Verify local backup dir tồn tại
if [ ! -d "$LOCAL_BACKUP_DIR" ]; then
    log "ERROR: $LOCAL_BACKUP_DIR không tồn tại — chưa có backup nào?"
    exit 1
fi

# Tạo daily folder remote
TODAY=$(date +%Y-%m-%d)
REMOTE_PATH="${REMOTE_NAME}:${REMOTE_BUCKET}/${TODAY}/"

# Đẩy mọi backup mới hơn 24h
log "Syncing backups newer than 24h to ${REMOTE_PATH}"
rclone copy "$LOCAL_BACKUP_DIR" "$REMOTE_PATH" \
    --max-age 24h \
    --include "pre-deploy-*.sql.gz" \
    --include "manual-*.sql.gz" \
    --transfers 2 \
    --checkers 2 \
    --stats 30s \
    --log-level INFO

# Verify upload thành công bằng cách list remote
REMOTE_COUNT=$(rclone ls "$REMOTE_PATH" 2>/dev/null | wc -l)
log "Uploaded ${REMOTE_COUNT} files to ${REMOTE_PATH}"

# Xoá remote backups cũ hơn retention period
log "Pruning remote backups older than ${RETENTION_DAYS} days"
rclone delete "${REMOTE_NAME}:${REMOTE_BUCKET}/" \
    --min-age "${RETENTION_DAYS}d" \
    --include "*.sql.gz"

# Health check ghi vào metrics file (Prometheus textfile collector có thể đọc)
METRICS_FILE="/var/lib/node_exporter/textfile_collector/pc02_offsite_backup.prom"
if [ -d "$(dirname "$METRICS_FILE")" ]; then
    cat > "$METRICS_FILE" <<EOF
# HELP pc02_offsite_backup_last_success_timestamp Last successful off-site backup Unix timestamp.
# TYPE pc02_offsite_backup_last_success_timestamp gauge
pc02_offsite_backup_last_success_timestamp $(date +%s)
# HELP pc02_offsite_backup_files_uploaded Number of files uploaded in the last run.
# TYPE pc02_offsite_backup_files_uploaded gauge
pc02_offsite_backup_files_uploaded ${REMOTE_COUNT}
EOF
fi

log "✓ Off-site backup completed successfully"
