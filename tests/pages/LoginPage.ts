import { Page, expect } from '@playwright/test';

/**
 * Page Object cho trang Login PC02.
 * Backend nhan field `username` (khong phai `email`).
 */
export class LoginPage {
  constructor(public readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(username: string, password: string): Promise<void> {
    await this.goto();
    // Truong input dau tien la username/email — chap nhan ca 2 type
    const userInput = this.page
      .locator('input[type="email"], input[name="username"], input[name="email"], input[type="text"]')
      .first();
    await userInput.fill(username);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    // Cho redirect — chap nhan /dashboard hoac /cases hoac /
    await expect(this.page).toHaveURL(/\/(dashboard|cases|home|tong-hop)?(\?|$)/, {
      timeout: 15_000,
    });
  }

  async logout(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /(Đăng xuất|Logout)/i });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }
}
