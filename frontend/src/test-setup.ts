import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Testing Library's default asyncUtilTimeout is 1000ms, which is measured
// against wall-clock, not work done. With 151 test files each spinning up its
// own jsdom, a loaded CI runner regularly pushes a legitimate `findBy*` past
// that budget, so PetitionFormPage.payload and CaseFormPage.saveAndExportFlow
// failed intermittently while passing in isolation. This raises the ceiling
// without weakening any assertion — a query that never resolves still fails,
// just later.
configure({ asyncUtilTimeout: 5000 });

// JSDOM polyfill: scrollIntoView is not implemented in jsdom by default.
// ProposeDeadlineRulePage.tsx:283 calls querySelector(...)?.scrollIntoView() on validation fail
// — works in browser, throws TypeError in tests. Polyfill keeps tests passing under jsdom.
// Surfaced by P2-003 fix (adding vitest to CI) — pre-existing latent issue.
if (typeof window !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
