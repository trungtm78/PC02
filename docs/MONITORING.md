# PC02 — Monitoring & Alerting (self-hosted)

**Sprint 3 / S3.3.** Self-hosted stack chạy chung VM với prod backend. Tổng RAM ~500MB, CPU steady ~3%. Cost $0/tháng.

## Stack components

| Component | Port (internal) | Vai trò |
|---|---|---|
| Prometheus | 9090 | Scrape `/api/v1/metrics`, evaluate alert rules |
| Alertmanager | 9093 | Route alert → email (SMTP) |
| Loki | 3100 | Log aggregation (chuẩn bị cho future log shipping) |
| Grafana | 3001 | Dashboard + log explore |
| Node exporter (optional) | 9100 | VM-level metrics |

## Setup (anh làm 1 lần)

```bash
ssh pc02vm
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker pc02
# logout + login lại để group có hiệu lực

cd /home/pc02
git clone <repo>  # nếu chưa có repo trên VM, hoặc copy thư mục scripts/monitoring
cd <repo>/scripts/monitoring
cp .env.example .env
# edit .env: GRAFANA_ADMIN_PASSWORD = strong password
# edit alertmanager.yml: SMTP creds + admin email

docker compose up -d
docker compose ps  # confirm tất cả 4 service "Up"

# Verify Prometheus scrape backend
curl -s http://127.0.0.1:9090/api/v1/targets | jq '.data.activeTargets[] | {scrapeUrl, health}'
# Expect: pc02-backend health=up

# Verify metrics endpoint reachable from Prometheus container
docker exec pc02-prometheus wget -qO- http://host.docker.internal:3000/api/v1/metrics | head -5
```

## Access Grafana (SSH tunnel)

```bash
# Từ máy anh:
ssh -L 3001:127.0.0.1:3001 pc02vm
# Mở browser: http://localhost:3001
# Login: admin / <GRAFANA_ADMIN_PASSWORD từ .env>
```

Data sources tự động provisioned (Prometheus + Loki). Anh có thể tạo dashboard mới hoặc import từ grafana.com.

## Counters available

| Metric | Labels | Mục đích |
|---|---|---|
| `pc02_login_attempts_total` | `result={success,failure,locked,2fa_setup_required}` | Brute-force detection, lockout pattern |
| `pc02_data_scope_denial_total` | `resource={parent,creator}` | IDOR probe detection |
| `pc02_2fa_verify_total` | `method,result` | 2FA usage tracking (future wire) |
| `pc02_audit_log_total` | `action` | Aggregate audit volume |
| `pc02_http_request_duration_seconds` | `method,route,status` | P95/P99 latency |
| `pc02_*` (default Node.js) | - | CPU, memory, event loop lag |
| `pc02_offsite_backup_*` | - | Off-site backup health (S3.2) |

## Alert rules (configured)

| Alert | Trigger | Severity |
|---|---|---|
| `BackendDown` | `up=0` for 1 min | critical |
| `BruteForceLogin` | >4 fail/sec for 2 min | warning |
| `BruteForceLoginCritical` | >20 fail/sec for 1 min | critical |
| `HighDataScopeDenial` | >1 deny/sec for 5 min | warning |
| `AccountLockoutSpike` | >5 lock/15min | warning |
| `HighRequestLatency` | P95 >2s for 5 min | warning |
| `OffsiteBackupStale` | >2 days no success | warning |

## Test alert firing

```bash
# Simulate brute-force: 30 fail login
for i in {1..30}; do
  curl -s -o /dev/null https://<domain>/api/v1/auth/login \
    -X POST -H "Content-Type: application/json" \
    -d '{"username":"fake@test","password":"WRONG"}'
done

# Check Prometheus đã thấy
curl -s 'http://127.0.0.1:9090/api/v1/query?query=rate(pc02_login_attempts_total{result="failure"}[5m])'

# Expect: alert fires sau 2 phút, email tới admin@<domain>
```

## Trouble-shooting

- **Prometheus không scrape được**: kiểm tra `host.docker.internal` resolve. Trên Linux cần `extra_hosts: ["host.docker.internal:host-gateway"]` (đã có trong compose).
- **Grafana không thấy data**: check Prometheus URL trong datasources.yml dùng container name `prometheus:9090`, không phải `localhost`.
- **Alert không fire**: Alertmanager log: `docker logs pc02-alertmanager`. SMTP creds sai là common cause.
