import { TestModeGuard } from './test-mode.guard';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

function ctx(headerValue: string | undefined): ExecutionContext {
  const req: { headers: Record<string, string | undefined> } = {
    headers: headerValue !== undefined ? { 'x-test-seed-token': headerValue } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('TestModeGuard', () => {
  const realMode = process.env['E2E_TEST_MODE'];
  const realToken = process.env['TEST_SEED_TOKEN'];

  afterEach(() => {
    if (realMode === undefined) {
      delete process.env['E2E_TEST_MODE'];
    } else {
      process.env['E2E_TEST_MODE'] = realMode;
    }
    if (realToken === undefined) {
      delete process.env['TEST_SEED_TOKEN'];
    } else {
      process.env['TEST_SEED_TOKEN'] = realToken;
    }
  });

  const guard = new TestModeGuard();

  it('returns 404 when E2E_TEST_MODE is unset (default for production)', () => {
    delete process.env['E2E_TEST_MODE'];
    process.env['TEST_SEED_TOKEN'] = 'a'.repeat(32);
    expect(() => guard.canActivate(ctx('a'.repeat(32)))).toThrow(NotFoundException);
  });

  it('returns 404 when E2E_TEST_MODE is set to any value other than the literal "true"', () => {
    process.env['E2E_TEST_MODE'] = 'TRUE'; // wrong case — refused
    process.env['TEST_SEED_TOKEN'] = 'a'.repeat(32);
    expect(() => guard.canActivate(ctx('a'.repeat(32)))).toThrow(NotFoundException);
  });

  it('returns 403 when TEST_SEED_TOKEN env is missing even in test mode', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    delete process.env['TEST_SEED_TOKEN'];
    expect(() => guard.canActivate(ctx('anything'))).toThrow(ForbiddenException);
  });

  it('returns 403 when TEST_SEED_TOKEN is shorter than 16 chars', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    process.env['TEST_SEED_TOKEN'] = 'short';
    expect(() => guard.canActivate(ctx('short'))).toThrow(ForbiddenException);
  });

  it('returns 403 when the X-Test-Seed-Token header is missing', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    process.env['TEST_SEED_TOKEN'] = 'a'.repeat(32);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('returns 403 when the X-Test-Seed-Token header does not match', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    process.env['TEST_SEED_TOKEN'] = 'a'.repeat(32);
    expect(() => guard.canActivate(ctx('b'.repeat(32)))).toThrow(ForbiddenException);
  });

  it('returns 403 when the header is the right length but one byte differs', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    process.env['TEST_SEED_TOKEN'] = 'a'.repeat(32);
    const almost = 'a'.repeat(31) + 'b';
    expect(() => guard.canActivate(ctx(almost))).toThrow(ForbiddenException);
  });

  it('grants access when mode is "true" AND tokens match exactly', () => {
    process.env['E2E_TEST_MODE'] = 'true';
    const tok = 'X1Y2Z3'.repeat(8); // 48 chars
    process.env['TEST_SEED_TOKEN'] = tok;
    expect(guard.canActivate(ctx(tok))).toBe(true);
  });
});
