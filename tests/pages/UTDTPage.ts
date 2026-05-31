import { Page, expect } from '@playwright/test';

/**
 * Page Object cho module UTDT — Ủy Thác Điều Tra.
 * UTDT là sub-feature của Cases (caseType=UY_THAC_DIEU_TRA).
 * Reuse các route /cases nhưng filter caseType + tab "Thông tin Ủy thác" trong CaseFormPage.
 *
 * Selector ưu tiên: data-testid > role/name > text > CSS.
 */
export class UTDTPage {
  constructor(public readonly page: Page) {}

  async gotoList(): Promise<void> {
    // List UTDT cases — filter caseType=UY_THAC_DIEU_TRA
    await this.page.goto('/cases?caseType=UY_THAC_DIEU_TRA');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoNew(): Promise<void> {
    // Form tạo UTDT — chọn caseType=UY_THAC_DIEU_TRA sẽ show tab "Thông tin Ủy thác"
    await this.page.goto('/cases/new?caseType=UY_THAC_DIEU_TRA');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoDetail(id: string): Promise<void> {
    await this.page.goto(`/cases/${id}`);
    await this.page.waitForLoadState('networkidle');
  }

  async gotoEdit(id: string): Promise<void> {
    await this.page.goto(`/cases/${id}/edit`);
    await this.page.waitForLoadState('networkidle');
  }

  /** Mở tab "Thông tin Ủy thác" trong CaseFormPage */
  async openUtdtTab(): Promise<void> {
    const tab = this.page
      .locator('[data-testid="tab-utdt"], [role="tab"]:has-text("Ủy thác"), button:has-text("Thông tin Ủy thác")')
      .first();
    await tab.click();
    await this.page.waitForTimeout(300);
  }

  async expectListVisible(): Promise<void> {
    const indicators = [
      this.page.locator('[data-testid="utdt-list-page"]'),
      this.page.locator('[data-testid="case-list-page"]'),
      this.page.getByRole('heading', { name: /(Ủy thác điều tra|Danh sách ủy thác|UTDT)/i }),
    ];
    let found = false;
    for (const ind of indicators) {
      if (await ind.first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, 'Danh sách UTDT không render').toBeTruthy();
  }

  async expectUtdtTabVisible(): Promise<void> {
    const tab = this.page
      .locator('[data-testid="tab-utdt"], [role="tab"]:has-text("Ủy thác")')
      .first();
    await expect(tab).toBeVisible();
  }

  /** Verify TrangThaiPhanHoi badge present (one of 4 computed states) */
  async expectTrangThaiBadge(state: 'DA_PHAN_HOI' | 'KHONG_THUC_HIEN_DUOC' | 'QUA_HAN' | 'CHUA_PHAN_HOI'): Promise<void> {
    const labelMap = {
      DA_PHAN_HOI: 'Đã phản hồi',
      KHONG_THUC_HIEN_DUOC: 'Không thực hiện được',
      QUA_HAN: 'Quá hạn',
      CHUA_PHAN_HOI: 'Chưa phản hồi',
    };
    const badge = this.page
      .locator(`[data-testid="trang-thai-phan-hoi-${state}"], :text-is("${labelMap[state]}")`)
      .first();
    await expect(badge).toBeVisible();
  }

  /** Fill UTDT form section 1 (basic info) */
  async fillUtdtBasic(opts: {
    loaiUyThac?: string;
    donViGiao?: string;
    soQuyetDinh?: string;
    ngayTiepNhan?: string;
    thoiHan?: string;
    loaiThongTin?: string;
  }): Promise<void> {
    if (opts.loaiUyThac) {
      await this.page.selectOption(
        '[data-testid="loaiUyThac"], select[name="loaiUyThac"]',
        opts.loaiUyThac,
      );
    }
    if (opts.donViGiao) {
      await this.page.fill(
        '[data-testid="donViGiao"], input[name="donViGiao"]',
        opts.donViGiao,
      );
    }
    if (opts.soQuyetDinh) {
      await this.page.fill(
        '[data-testid="soQuyetDinhUyThac"], input[name="soQuyetDinhUyThac"]',
        opts.soQuyetDinh,
      );
    }
    if (opts.ngayTiepNhan) {
      await this.page.fill(
        '[data-testid="ngayTiepNhan"], input[name="ngayTiepNhan"]',
        opts.ngayTiepNhan,
      );
    }
    if (opts.thoiHan) {
      await this.page.fill(
        '[data-testid="thoiHanUyThac"], input[name="thoiHanUyThac"]',
        opts.thoiHan,
      );
    }
    if (opts.loaiThongTin) {
      await this.page.fill(
        '[data-testid="loaiThongTin"], input[name="loaiThongTin"]',
        opts.loaiThongTin,
      );
    }
  }

  /** Filter list theo trangThaiPhanHoi */
  async filterByTrangThai(state: 'DA_PHAN_HOI' | 'KHONG_THUC_HIEN_DUOC' | 'QUA_HAN' | 'CHUA_PHAN_HOI'): Promise<void> {
    const chip = this.page
      .locator(`[data-testid="filter-trang-thai-${state}"], button:has-text("${state}")`)
      .first();
    await chip.click();
    await this.page.waitForLoadState('networkidle');
  }
}
