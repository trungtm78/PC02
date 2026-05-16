import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Hotfix: defense-in-depth IP allowlist guard cho /api/v1/metrics.
 *
 * Vì sao có guard này khi đã có nginx `allow 127.0.0.1; deny all;`:
 *   1. Nếu nginx config bị reset/lỡ apply (case thực tế: Sprint 3 ship nginx
 *      template nhưng anh chưa apply lên VM) → endpoint expose Internet, leak
 *      Prometheus metrics (login counters, CPU, memory, 2FA stats) cho attacker.
 *   2. Direct access port 3000 (nếu firewall lỏng) → bypass nginx hoàn toàn.
 *
 * Allowlist:
 *   - 127.0.0.1 và ::1 (Prometheus container scrape qua localhost)
 *   - Override env METRICS_ALLOWED_IPS (comma-separated) cho VM khác scrape
 *
 * Behind reverse proxy: Express `req.ip` đã honor X-Forwarded-For khi
 * `app.set('trust proxy', 1)` (đã set trong main.ts). Vậy nginx forward
 * request gốc từ Prometheus container thì req.ip = 127.0.0.1.
 */
@Injectable()
export class MetricsIpAllowlistGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor() {
    const envList = (process.env.METRICS_ALLOWED_IPS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.allowed = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', ...envList]);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? '';
    if (this.allowed.has(ip)) return true;
    throw new ForbiddenException('Metrics endpoint chỉ truy cập từ internal network');
  }
}
