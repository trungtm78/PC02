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
    // Đúng route UTDT list page (v0.44+)
    await this.page.goto('/uy-thac-dieu-tra');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoNew(): Promise<void> {
    // Redirect qua /cases/new với caseProvenance
    await this.page.goto('/uy-thac-dieu-tra/new');
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

  /** Filter list theo trangThaiPhanHoi chip */
  async filterByTrangThai(state: 'DA_PHAN_HOI' | 'KHONG_THUC_HIEN_DUOC' | 'QUA_HAN' | 'CHUA_PHAN_HOI'): Promise<void> {
    const labelMap = {
      DA_PHAN_HOI: 'Đã phản hồi',
      KHONG_THUC_HIEN_DUOC: 'Không thực hiện',
      QUA_HAN: 'Quá hạn',
      CHUA_PHAN_HOI: 'Chưa phản hồi',
    };
    // Tìm chip theo text label hoặc data-testid
    const chip = this.page
      .locator(`button:has-text("${labelMap[state]}"), [data-testid="status-chip-${state}"]`)
      .first();
    await chip.click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Verify bulk selection checkboxes hiển thị trong bảng (Bug 1 fix) */
  async expectBulkCheckboxesVisible(): Promise<void> {
    // Header checkbox
    const headerCheckbox = this.page.locator('thead input[type="checkbox"]');
    await expect(headerCheckbox).toBeVisible();
    // Ít nhất một row checkbox
    const rowCheckboxes = this.page.locator('tbody input[type="checkbox"]');
    const count = await rowCheckboxes.count();
    expect(count, 'Phải có ít nhất 1 row checkbox').toBeGreaterThan(0);
  }

  /** Chọn row đầu tiên trong bảng và verify BulkActionBar xuất hiện */
  async selectFirstRowAndExpectBulkBar(): Promise<void> {
    const firstRowCheckbox = this.page.locator('tbody input[type="checkbox"]').first();
    await firstRowCheckbox.check();
    // BulkActionBar (sticky bottom) phải xuất hiện
    const bulkBar = this.page.locator('[data-testid="list-page-shell-bulk-bar"], [role="toolbar"][aria-label*="hàng loạt"]');
    await expect(bulkBar).toBeVisible();
    const countText = this.page.locator('[data-testid="list-page-shell-bulk-count"]');
    await expect(countText).toContainText('1');
  }

  /** Stats cards strip: verify 5 cards xuất hiện */
  async expectStatsCardsVisible(): Promise<void> {
    // StatsCardsStrip render cards với số liệu
    const cards = this.page.locator('[data-testid^="stat-card"], .stat-card, [class*="StatsCard"]');
    const count = await cards.count();
    expect(count, 'Phải có ít nhất 5 stats cards').toBeGreaterThanOrEqual(5);
  }

  /** Delete modal: mở, điền lý do, xác nhận */
  async deleteFirstRowWithReason(reason: string): Promise<void> {
    const trashBtn = this.page
      .locator('tbody tr')
      .first()
      .locator('button[title*="Xóa"], button[aria-label*="Xóa"]');
    await trashBtn.click();
    // Modal mở
    const modal = this.page.locator('[role="dialog"], [data-testid="utdt-delete-modal"]');
    await expect(modal).toBeVisible();
    // Điền lý do
    const textarea = this.page.locator('[data-testid="utdt-delete-reason"], textarea[minlength="10"]');
    await textarea.fill(reason);
    // Click confirm
    const confirmBtn = this.page.getByRole('button', { name: /xác nhận xóa/i });
    await confirmBtn.click();
    await this.page.waitForLoadState('networkidle');
  }
}
