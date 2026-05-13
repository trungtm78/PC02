import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMobileDownloadConfig } from '../mobile-download';

/**
 * Vitest exposes import.meta.env via vi.stubEnv — preferred over manual
 * monkey-patching. We restore between tests so leakage doesn't poison other
 * helpers that read the same env keys.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getMobileDownloadConfig', () => {
  it('returns androidUrl: null when VITE_MOBILE_ANDROID_URL is unset', () => {
    vi.stubEnv('VITE_MOBILE_ANDROID_URL', '');
    expect(getMobileDownloadConfig().androidUrl).toBeNull();
  });

  it('returns the env value when VITE_MOBILE_ANDROID_URL is set', () => {
    vi.stubEnv(
      'VITE_MOBILE_ANDROID_URL',
      'http://171.244.40.245/downloads/latest.apk',
    );
    expect(getMobileDownloadConfig().androidUrl).toBe(
      'http://171.244.40.245/downloads/latest.apk',
    );
  });

  it('returns iosUrl: null when VITE_MOBILE_IOS_URL is unset', () => {
    vi.stubEnv('VITE_MOBILE_IOS_URL', '');
    expect(getMobileDownloadConfig().iosUrl).toBeNull();
  });

  it('returns iosUrl value when VITE_MOBILE_IOS_URL is set', () => {
    vi.stubEnv('VITE_MOBILE_IOS_URL', 'https://testflight.apple.com/join/abc');
    expect(getMobileDownloadConfig().iosUrl).toBe(
      'https://testflight.apple.com/join/abc',
    );
  });

  it('reports iosAvailable: false even when iosUrl env is set (gated flag for now)', () => {
    // Until iOS app ships through TestFlight/App Store, iosAvailable stays
    // false regardless of the env var. This lets infra ship the env name
    // ahead of the actual app without accidentally exposing a half-ready
    // download path. Flip the flag inside the helper when iOS ships.
    vi.stubEnv('VITE_MOBILE_IOS_URL', 'https://testflight.apple.com/join/abc');
    expect(getMobileDownloadConfig().iosAvailable).toBe(false);
  });

  it('treats whitespace-only env value as unset', () => {
    vi.stubEnv('VITE_MOBILE_ANDROID_URL', '   ');
    expect(getMobileDownloadConfig().androidUrl).toBeNull();
  });
});
