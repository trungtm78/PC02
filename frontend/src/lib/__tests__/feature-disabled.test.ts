/**
 * A disabled feature answers 404, on purpose — a distinct status code would
 * let a caller enumerate which modules are switched off. The body is what
 * carries the difference, and until something read it every screen showed its
 * own "not found" message: to an officer that reads like their case file
 * disappeared, not like an administrator flipped a switch.
 */
import { describe, it, expect } from 'vitest';
import {
  FEATURE_DISABLED_ERROR,
  extractFeatureDisabled,
  isFeatureDisabledError,
} from '../feature-disabled';

function axiosError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

describe('isFeatureDisabledError', () => {
  it('recognises the guard body', () => {
    expect(
      isFeatureDisabledError(
        axiosError(404, {
          statusCode: 404,
          error: FEATURE_DISABLED_ERROR,
          feature: 'cases',
          message: 'Tính năng "Vụ án" hiện đang tắt',
        }),
      ),
    ).toBe(true);
  });

  it('recognises it when Nest nests the object under message', () => {
    // Nest wraps a thrown object literal differently depending on the path it
    // takes, so both shapes have to work or the branch fires only sometimes.
    expect(
      isFeatureDisabledError(
        axiosError(404, {
          message: {
            statusCode: 404,
            error: FEATURE_DISABLED_ERROR,
            feature: 'cases',
            message: 'Tính năng "Vụ án" hiện đang tắt',
          },
        }),
      ),
    ).toBe(true);
  });

  it('does not fire on an ordinary 404 — the whole point of the check', () => {
    expect(
      isFeatureDisabledError(
        axiosError(404, { statusCode: 404, message: 'Không tìm thấy' }),
      ),
    ).toBe(false);
  });

  it('does not fire on other statuses carrying the same string', () => {
    expect(
      isFeatureDisabledError(
        axiosError(403, { error: FEATURE_DISABLED_ERROR }),
      ),
    ).toBe(false);
  });

  it('survives a response with no body at all', () => {
    expect(isFeatureDisabledError(axiosError(404, undefined))).toBe(false);
    expect(isFeatureDisabledError(new Error('network'))).toBe(false);
    expect(isFeatureDisabledError(undefined)).toBe(false);
  });
});

describe('extractFeatureDisabled', () => {
  it('returns the server sentence, ready to display', () => {
    const detail = extractFeatureDisabled(
      axiosError(404, {
        error: FEATURE_DISABLED_ERROR,
        feature: 'kpi',
        message: 'Tính năng "KPI" hiện đang tắt',
      }),
    );

    expect(detail).toEqual({
      feature: 'kpi',
      message: 'Tính năng "KPI" hiện đang tắt',
    });
  });

  it('falls back to a sentence of its own rather than showing an empty banner', () => {
    const detail = extractFeatureDisabled(
      axiosError(404, { error: FEATURE_DISABLED_ERROR }),
    );

    expect(detail.feature).toBe('');
    expect(detail.message.length).toBeGreaterThan(0);
  });
});
