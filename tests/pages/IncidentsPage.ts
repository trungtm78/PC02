import { Page, expect } from '@playwright/test';

/**
 * Page Object cho module Quan ly Vu Viec (/incidents).
 * Selector uu tien: data-testid > role/name > text > CSS.
 */
export class IncidentsPage {
  constructor(public readonly page: Page) {}

  async gotoList(): Promise<void> {
    // App dùng /vu-viec (slug tiếng Việt); /incidents vẫn hoạt động nhờ alias
    await this.page.goto('/vu-viec');
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/vu-viec/new');
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async gotoDetail(id: string): Promise<void> {
    await this.page.goto(`/vu-viec/${id}`);
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async expectListVisible(): Promise<void> {
    const indicators = [
      this.page.locator('[data-testid="incident-list-page"]'),
      this.page.locator('[data-testid="incident-table"]'),
      this.page.getByRole('heading', { name: /(Quản lý vụ việc|Danh sách vụ việc|Vụ việc)/i }),
    ];
    let found = false;
    for (const ind of indicators) {
      if (await ind.first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, 'Danh sach vu viec khong render').toBeTruthy();
  }

  async clickCreateButton(): Promise<void> {
    const btn = this.page.locator(
      '[data-testid="btn-add-incident"], button:has-text("Thêm mới"), button:has-text("Tạo mới"), a:has-text("Thêm mới")'
    ).first();
    await btn.click();
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  async fillName(name: string): Promise<void> {
    const field = this.page.locator(
      '[data-testid="field-name"], input[placeholder*="tên vụ việc"], input[name="name"]'
    ).first();
    await field.fill(name);
  }

  async fillFromDate(date: string): Promise<void> {
    const field = this.page.locator(
      '[data-testid="field-fromDate"], input[type="date"][name*="from"], input[placeholder*="ngày"]'
    ).first();
    await field.fill(date);
  }

  async submitForm(): Promise<void> {
    const btn = this.page.locator(
      'button[type="submit"], [data-testid="btn-submit"], button:has-text("Lưu"), button:has-text("Tạo")'
    ).first();
    await btn.click();
  }
}
