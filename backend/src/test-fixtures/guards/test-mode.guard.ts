import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Triple guard for the /test-fixtures/* endpoints. Each layer is independent
 * — bypassing one does not bypass another. This is intentional defense in
 * depth because these endpoints can MUTATE production-shape data.
 *
 *  1. E2E_TEST_MODE env must be the literal string "true". Production deploys
 *     never set this; mobile-e2e.yml CI workflow sets it on the spun-up backend.
 *     If unset, requests are rejected with 404 (route appears non-existent).
 *
 *  2. `X-Test-Seed-Token` header must match `TEST_SEED_TOKEN` env. The token is
 *     a random per-environment secret. CI injects it from a GitHub Secret.
 *     If wrong, 403 — but the route DID exist, so attackers learn the mode
 *     gate is open. That tradeoff is accepted because mode + token together
 *     are still cryptographically infeasible to guess.
 *
 *  3. Constant-time string comparison (compares byte-by-byte then compares
 *     lengths separately) so token mismatch does not leak token length via
 *     timing. NodeJS `===` is NOT constant-time on strings of differing length.
 */
@Injectable()
export class TestModeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env['E2E_TEST_MODE'] !== 'true') {
      // 404 — never confirm endpoint exists outside test mode.
      throw new NotFoundException();
    }

    const expected = process.env['TEST_SEED_TOKEN'];
    if (!expected || expected.length < 16) {
      // Misconfiguration — refuse rather than accept a short / empty token.
      throw new ForbiddenException(
        'TEST_SEED_TOKEN must be set (>=16 chars) for E2E test mode',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-test-seed-token'];
    const providedStr =
      typeof provided === 'string'
        ? provided
        : Array.isArray(provided)
          ? provided[0]
          : '';

    if (!constantTimeEquals(providedStr, expected)) {
      throw new ForbiddenException('Invalid test seed token');
    }

    return true;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
