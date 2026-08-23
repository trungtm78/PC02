import { Page, expect } from '@playwright/test';

/**
 * Page Object cho module Quan ly vu viec (/cases).
 * Selector uu tien: data-testid > role/name > text > CSS.
 */
export class CasesPage {
  constructor(public readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto('/cases');
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/cases/new');
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async gotoDetail(id: string): Promise<void> {
    await this.page.goto(`/cases/${id}`);
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async gotoEdit(id: string): Promise<void> {
    await this.page.goto(`/cases/${id}/edit`);
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async expectListVisible(): Promise<void> {
    // Chap nhan nhieu kha nang selector
    const indicators = [
      this.page.locator('[data-testid="case-list-page"]'),
      this.page.locator('[data-testid="case-table"]'),
      this.page.getByRole('heading', { name: /(Quản lý vụ án|Danh sách vụ án|Vụ án)/i }),
    ];
    let found = false;
    for (const ind of indicators) {
      if (await ind.first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, 'Danh sach vu an khong render').toBeTruthy();
  }
}
