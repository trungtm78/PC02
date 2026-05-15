#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

# SEC (CSO finding): seed bị-mặc-định-tắt để tránh container restart reset password admin
# về SEED_ADMIN_PASSWORD. Chỉ chạy seed khi explicit opt-in qua RUN_SEED=true (first boot).
if [ "${RUN_SEED:-false}" = "true" ]; then
    echo "[entrypoint] RUN_SEED=true — seeding database (idempotent)..."
    npm run db:seed || echo "[entrypoint] Seed skipped or already applied."
else
    echo "[entrypoint] RUN_SEED not set — skipping seed (set RUN_SEED=true for first boot)."
fi

echo "[entrypoint] Starting NestJS..."
exec node dist/main
