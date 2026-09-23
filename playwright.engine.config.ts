import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình RIÊNG cho cổng engine — KHÔNG `webServer`, KHÔNG `globalSetup`.
 *
 * Vì sao tách khỏi `playwright.config.ts`: cấu hình chính khởi động cả backend (`nest start`)
 * lẫn frontend trước khi chạy, và `globalSetup` đòi đăng nhập. Cổng engine không cần thứ nào
 * trong số đó — nó chỉ dựng một `<input type="date">` bằng `setContent` rồi đọc `.value`.
 *
 * Codex bắt 24/09/2026: job CI chỉ cài phụ thuộc ở gốc kho, nên runner sạch thiếu `nest`,
 * `webServer` không lên được và **test không bao giờ chạy**. Một cổng không chạy thì tệ hơn
 * không có cổng, vì nó làm người đọc tưởng đã được canh.
 */
export default defineConfig({
  testDir: './tests/engine',
  testMatch: '**/*.engine.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: 'line',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'engine-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'engine-webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
