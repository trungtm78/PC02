import '@testing-library/jest-dom';

// JSDOM polyfill: scrollIntoView is not implemented in jsdom by default.
// ProposeDeadlineRulePage.tsx:283 calls querySelector(...)?.scrollIntoView() on validation fail
// — works in browser, throws TypeError in tests. Polyfill keeps tests passing under jsdom.
// Surfaced by P2-003 fix (adding vitest to CI) — pre-existing latent issue.
if (typeof window !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// JSDOM polyfill: Pointer Capture chưa có trong jsdom.
//
// Tay nắm kéo giãn cột dùng `setPointerCapture` để giữ chuỗi sự kiện khi con trỏ ra ngoài tay
// nắm — không có nó thì thả tay ngoài vùng là cột kẹt ở bề rộng dở dang. jsdom chưa cài ba
// hàm này nên mọi ca kiểm chạm vào kéo giãn sẽ ném TypeError thay vì kiểm được hành vi.
if (typeof window !== 'undefined' && !Element.prototype.setPointerCapture) {
  const bat = new Set<number>();
  Element.prototype.setPointerCapture = function (id: number) {
    bat.add(id);
  };
  Element.prototype.releasePointerCapture = function (id: number) {
    bat.delete(id);
  };
  Element.prototype.hasPointerCapture = function (id: number) {
    return bat.has(id);
  };
}
