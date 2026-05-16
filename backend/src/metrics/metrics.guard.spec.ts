import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { MetricsIpAllowlistGuard } from './metrics.guard';

function makeCtx(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as ExecutionContext;
}

describe('MetricsIpAllowlistGuard', () => {
  beforeEach(() => {
    delete process.env.METRICS_ALLOWED_IPS;
  });

  it('cho phép IPv4 loopback 127.0.0.1', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(guard.canActivate(makeCtx('127.0.0.1'))).toBe(true);
  });

  it('cho phép IPv6 loopback ::1', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(guard.canActivate(makeCtx('::1'))).toBe(true);
  });

  it('cho phép IPv4-mapped IPv6 ::ffff:127.0.0.1 (Express default)', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(guard.canActivate(makeCtx('::ffff:127.0.0.1'))).toBe(true);
  });

  it('reject IP public', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx('203.0.113.42'))).toThrow(ForbiddenException);
  });

  it('reject IP local network không allowlist', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx('192.168.1.5'))).toThrow(ForbiddenException);
  });

  it('reject empty IP (defense hơn trust proxy misconfig)', () => {
    const guard = new MetricsIpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx(''))).toThrow(ForbiddenException);
  });

  it('hợp METRICS_ALLOWED_IPS env (comma-separated extra)', () => {
    process.env.METRICS_ALLOWED_IPS = '10.0.0.5,10.0.0.6';
    const guard = new MetricsIpAllowlistGuard();
    expect(guard.canActivate(makeCtx('10.0.0.5'))).toBe(true);
    expect(guard.canActivate(makeCtx('10.0.0.6'))).toBe(true);
    expect(() => guard.canActivate(makeCtx('10.0.0.7'))).toThrow(ForbiddenException);
  });
});
