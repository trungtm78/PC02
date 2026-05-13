/**
 * Mobile download configuration surfaced on the LoginPage "Tải ứng dụng di
 * động" section. URLs come from Vite build-time env vars; an empty / unset
 * value yields `null` so the UI can render a "Sắp ra mắt" placeholder
 * instead of an unusable QR.
 *
 * Why a helper module (vs inline `import.meta.env` reads in the component):
 *   1. Tests can stub env via `vi.stubEnv` and exercise the boundary.
 *   2. Whitespace / empty-string normalization lives in one place.
 *   3. `iosAvailable` is a feature flag that the helper owns — once iOS
 *      distribution exists, flipping one line here cascades to every caller.
 */
export interface MobileDownloadConfig {
  androidUrl: string | null;
  iosUrl: string | null;
  iosAvailable: boolean;
}

function normalize(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getMobileDownloadConfig(): MobileDownloadConfig {
  return {
    androidUrl: normalize(import.meta.env.VITE_MOBILE_ANDROID_URL),
    iosUrl: normalize(import.meta.env.VITE_MOBILE_IOS_URL),
    // Hard-coded to false until iOS distribution (TestFlight or App Store)
    // exists. Plan PR3 / iOS-launch is the trigger to derive this from
    // `iosUrl != null` instead.
    iosAvailable: false,
  };
}
