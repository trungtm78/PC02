import '@testing-library/jest-dom';

// JSDOM polyfill: scrollIntoView is not implemented in jsdom by default.
// ProposeDeadlineRulePage.tsx:283 calls querySelector(...)?.scrollIntoView() on validation fail
// — works in browser, throws TypeError in tests. Polyfill keeps tests passing under jsdom.
// Surfaced by P2-003 fix (adding vitest to CI) — pre-existing latent issue.
if (typeof window !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
