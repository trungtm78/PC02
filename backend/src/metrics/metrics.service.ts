import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { setScopeDenialCounter } from '../common/utils/scope-filter.util';

/**
 * Sprint 3 / S3.3 — Prometheus metrics service.
 *
 * Expose Prometheus-format metrics tại `/api/v1/metrics`. Stack scraping:
 * Prometheus → scrape endpoint → Loki/Alertmanager → email/SMS alert.
 *
 * Self-hosted stack (docker-compose ở `scripts/monitoring/`): Prometheus + Loki
 * + Grafana + Alertmanager. Tất cả chạy nội bộ VM cùng prod backend, port nội bộ
 * (127.0.0.1:9090, etc.), truy cập qua SSH tunnel của anh — không expose Internet.
 *
 * Counter quan trọng cho security monitoring:
 *   - pc02_login_attempts_total{result}: phát hiện brute-force pattern
 *   - pc02_data_scope_denial_total{resource}: phát hiện IDOR probe
 *   - pc02_2fa_verify_total{method,result}: track 2FA usage
 *   - pc02_audit_log_total{action}: aggregate audit volume per action
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // Security counters
  readonly loginAttempts: Counter<string>;
  readonly dataScopeDenials: Counter<string>;
  readonly twoFaVerify: Counter<string>;
  readonly auditLog: Counter<string>;

  // Performance histograms
  readonly httpRequestDuration: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    // Add default Node.js process metrics (CPU, memory, event loop lag)
    collectDefaultMetrics({ register: this.registry, prefix: 'pc02_' });

    this.loginAttempts = new Counter({
      name: 'pc02_login_attempts_total',
      help: 'Tổng số login attempts',
      labelNames: ['result'], // success | failure | locked | 2fa_setup_required
      registers: [this.registry],
    });

    this.dataScopeDenials = new Counter({
      name: 'pc02_data_scope_denial_total',
      help: 'Số lần DataScope/IDOR check throws ForbiddenException',
      labelNames: ['resource'], // case | incident | petition | ...
      registers: [this.registry],
    });

    this.twoFaVerify = new Counter({
      name: 'pc02_2fa_verify_total',
      help: 'Số lần 2FA verify attempts',
      labelNames: ['method', 'result'], // totp|email_otp|backup × success|failure
      registers: [this.registry],
    });

    this.auditLog = new Counter({
      name: 'pc02_audit_log_total',
      help: 'Số audit log entries theo action type',
      labelNames: ['action'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'pc02_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Wire scope-filter utility (pure function, không inject service được)
    // tới Prometheus counter — increment khi DataScope assertion throws Forbidden.
    setScopeDenialCounter(this.dataScopeDenials);
  }

  /** Returns Prometheus exposition format string. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Returns Content-Type cho Prometheus scrape response. */
  getContentType(): string {
    return this.registry.contentType;
  }
}
