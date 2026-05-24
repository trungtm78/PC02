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
    await this._attempt(username, password);
  }

  private async _attempt(username: string, password: string, retried = false): Promise<void> {
    await this.goto();
    const userInput = this.page
      .locator('input[type="email"], input[name="username"], input[name="email"], input[type="text"]')
      .first();
    await userInput.fill(username);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    // Chap nhan bat ky URL nao sau khi login (khong phai /login)
    try {
      await this.page.waitForFunction(
        () => !window.location.pathname.startsWith('/login'),
        { timeout: 12_000 }
      );
    } catch (err) {
      if (!retried) {
        // Rate-limit cooldown: wait 5s then retry once
        await this.page.waitForTimeout(5_000);
        return this._attempt(username, password, true);
      }
      throw err;
    }
  }

  async logout(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /(Đăng xuất|Logout)/i });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }
}
