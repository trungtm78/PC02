import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID } from '../uuid';

describe('randomUUID', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID() when available (secure context / localhost / HTTPS)', () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    const spy = vi.fn(() => fake);
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: spy });

    expect(randomUUID()).toBe(fake);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  /**
   * Monkey test 12/10/2026 bắt được thật trên production (HTTP, chưa có TLS):
   * Chromium không expose `crypto.randomUUID` ngoài secure context — gọi thẳng
   * làm crash `IncidentFormPage` ngay lúc render (`useRef` đánh giá tham số mỗi
   * lần render, không chỉ lần đầu).
   */
  it('falls back to a v4 UUID built from crypto.getRandomValues() when randomUUID is missing (plain HTTP)', () => {
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: (arr: Uint8Array) => {
        arr.fill(0xab);
        return arr;
      },
    });

    const id = randomUUID();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('never throws even when crypto.randomUUID is absent', () => {
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    });

    expect(() => randomUUID()).not.toThrow();
  });
});
