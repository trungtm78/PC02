#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Seeding database (idempotent)..."
npm run db:seed || echo "[entrypoint] Seed skipped or already applied."

echo "[entrypoint] Starting NestJS..."
exec node dist/main
