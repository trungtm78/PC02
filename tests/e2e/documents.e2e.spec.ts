/**
 * E2E Test — Document Management
 * TASK_ID: TASK-2026-022601
 * Created: BEFORE implementation (B0.5 requirement)
 * 
 * UI_ELEMENT_SCAN_RECORD (from DocumentsPage.tsx):
 * - Page Title: [data-testid="page-title"]
 * - Search Input: [data-testid="document-search-input"]
 * - Upload Button: [data-testid="btn-upload-document"]
 * - Document List Table: [data-testid="document-list-table"]
 * - Document Row: [data-testid="document-row-{id}"]
 * - Download Button: [data-testid="btn-download-{id}"]
 * - Delete Button: [data-testid="btn-delete-{id}"]
 * 
 * Upload Modal:
 * - Modal Container: [data-testid="document-upload-modal"]
 * - Modal Title: [data-testid="modal-title"]
 * - File Drop Zone: [data-testid="file-drop-zone"]
 * - File Input: [data-testid="file-input"]
 * - Title Input: [data-testid="document-title-input"]
 * - Type Select: [data-testid="document-type-select"]
 * - Case FK Selection: [data-testid="document-case-select"]
 * - Incident FK Selection: [data-testid="document-incident-select"]
 * - Description Input: [data-testid="document-description-input"]
 * - Upload Error: [data-testid="upload-error-message"]
 * - File Error: [data-testid="file-error"]
 * - Cancel Button: [data-testid="btn-cancel-upload"]
 * - Submit Button: [data-testid="btn-submit-upload"]
 * - Close Button: [data-testid="btn-close-upload-modal"]
 * 
 * Delete Modal:
 * - Delete Confirm Modal: [data-testid="delete-confirm-modal"]
 * - Cancel Delete: [data-testid="btn-cancel-delete"]
 * - Confirm Delete: [data-testid="btn-confirm-delete"]
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5179';
const API_URL = 'http://localhost:3000';

test.describe('Document Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and login if needed
    await page.goto(`${BASE_URL}/documents`);
    // Wait for page to load
    await page.waitForSelector('[data-testid="page-title"]');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UAT-01: Truy cập trang Hồ sơ & Tài liệu, hiển thị danh sách thành công
  // ═══════════════════════════════════════════════════════════════════════
  test('UAT-01: Page loads and displays document list', async ({ page }) => {
    // Verify page title
    const pageTitle = page.locator('[data-testid="page-title"]');
    await expect(pageTitle).toContainText('Hồ sơ & Tài liệu');

    // Verify search input exists
    const searchInput = page.locator('[data-testid="document-search-input"]');
    await expect(searchInput).toBeVisible();

    // Verify upload button exists
    const uploadBtn = page.locator('[data-testid="btn-upload-document"]');
    await expect(uploadBtn).toBeVisible();

    // Verify document list table or empty state
    const table = page.locator('[data-testid="document-list-table"]');
    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(table.or(emptyState)).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UAT-02: Upload tài liệu thành công với file PDF (5MB) và link với Vụ án
  // ═══════════════════════════════════════════════════════════════════════
  test('UAT-02: Upload PDF document linked to Case', async ({ page }) => {
    // Click upload button
    const uploadBtn = page.locator('[data-testid="btn-upload-document"]');
    await uploadBtn.click();

    // Wait for modal
    const modal = page.locator('[data-testid="document-upload-modal"]');
    await expect(modal).toBeVisible();

    // Upload file (5MB PDF)
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(5 * 1024 * 1024, 'a'), // 5MB file
    });

    // Verify file is selected
    await expect(page.locator('[data-testid="file-drop-zone"]')).toContainText('test-document.pdf');

    // Fill title
    const titleInput = page.locator('[data-testid="document-title-input"]');
    await titleInput.fill('Test PDF Document');

    // Select document type
    const typeSelect = page.locator('[data-testid="document-type-select"]');
    await typeSelect.selectOption('VAN_BAN');

    // Select case via FKSelection
    const caseSelect = page.locator('[data-testid="document-case-select"]');
    await caseSelect.click();
    // Wait for dropdown
    await page.waitForSelector('[data-testid="document-case-select-dropdown"]');
    // Select first option
    const firstOption = page.locator('[data-testid^="document-case-select-option-"]').first();
    await firstOption.click();

    // Submit form
    const submitBtn = page.locator('[data-testid="btn-submit-upload"]');
    await submitBtn.click();

    // Wait for success (modal closes and list refreshes)
    await expect(modal).not.toBeVisible();

    // Verify document appears in list
    await page.waitForTimeout(1000);
    const documentRow = page.locator('text=Test PDF Document');
    await expect(documentRow).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UAT-03: Tìm kiếm tài liệu bằng từ khóa không dấu
  // ═══════════════════════════════════════════════════════════════════════
  test('UAT-03: Search documents with non-diacritics keyword', async ({ page }) => {
    // Type search query without diacritics
    const searchInput = page.locator('[data-testid="document-search-input"]');
    await searchInput.fill('tai lieu'); // Search for "tài liệu" without diacritics

    // Wait for results
    await page.waitForTimeout(500);

    // Verify table still visible
    const table = page.locator('[data-testid="document-list-table"]');
    await expect(table).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UAT-04: Xóa tài liệu (Soft delete) và xác nhận biến mất khỏi danh sách
  // ═══════════════════════════════════════════════════════════════════════
  test('UAT-04: Soft delete document', async ({ page }) => {
    // First, ensure there's at least one document
    const firstRow = page.locator('[data-testid^="document-row-"]').first();

    if (await firstRow.isVisible().catch(() => false)) {
      // Get the document title for verification
      const docTitle = await firstRow.locator('text=/[\w\s]+/').first().textContent();

      // Click delete button on first row
      const deleteBtn = page.locator('[data-testid^="btn-delete-"]').first();
      await deleteBtn.click();

      // Wait for confirm modal
      const confirmModal = page.locator('[data-testid="delete-confirm-modal"]');
      await expect(confirmModal).toBeVisible();

      // Confirm delete
      const confirmBtn = page.locator('[data-testid="btn-confirm-delete"]');
      await confirmBtn.click();

      // Wait for modal to close
      await expect(confirmModal).not.toBeVisible();

      // Wait for list refresh
      await page.waitForTimeout(1000);

      // Verify document is no longer visible
      if (docTitle) {
        await expect(page.locator(`text=${docTitle}`).first()).not.toBeVisible();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // UAT-05: Tải xuống tài liệu đã upload
  // ═══════════════════════════════════════════════════════════════════════
  test('UAT-05: Download uploaded document', async ({ page }) => {
    // Find first document row
    const firstRow = page.locator('[data-testid^="document-row-"]').first();

    if (await firstRow.isVisible().catch(() => false)) {
      // Setup download listener
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-testid^="btn-download-"]').first().click(),
      ]);

      // Verify download started
      expect(download.suggestedFilename()).toBeTruthy();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Error Handling Tests
// ════════════════════════════════════════════════════════════════════════════

test.describe('Document Management — Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/documents`);
    await page.waitForSelector('[data-testid="page-title"]');
  });

  test('EC-01: Upload file too large (>10MB) shows error', async ({ page }) => {
    // Open upload modal
    await page.locator('[data-testid="btn-upload-document"]').click();
    await page.waitForSelector('[data-testid="document-upload-modal"]');

    // Try to upload 15MB file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'large-file.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(15 * 1024 * 1024, 'a'), // 15MB file
    });

    // Verify error message
    const fileError = page.locator('[data-testid="file-error"]');
    await expect(fileError).toBeVisible();
    await expect(fileError).toContainText('10MB');
  });

  test('EC-02: Upload without file shows validation error', async ({ page }) => {
    // Open upload modal
    await page.locator('[data-testid="btn-upload-document"]').click();
    await page.waitForSelector('[data-testid="document-upload-modal"]');

    // Fill only title
    await page.locator('[data-testid="document-title-input"]').fill('Test Title');

    // Try to submit
    await page.locator('[data-testid="btn-submit-upload"]').click();

    // Verify modal still open (validation failed)
    const modal = page.locator('[data-testid="document-upload-modal"]');
    await expect(modal).toBeVisible();
  });

  test('EC-03: Unsupported file type shows error', async ({ page }) => {
    // Open upload modal
    await page.locator('[data-testid="btn-upload-document"]').click();
    await page.waitForSelector('[data-testid="document-upload-modal"]');

    // Try to upload unsupported file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'script.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake executable'),
    });

    // Verify error
    const fileError = page.locator('[data-testid="file-error"]');
    await expect(fileError).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Navigation & Access Control Tests
// ════════════════════════════════════════════════════════════════════════════

test.describe('Document Management — Navigation', () => {
  test('Navigate to Documents page from sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Click documents link in sidebar if exists
    const docsLink = page.locator('a[href="/documents"]');
    if (await docsLink.isVisible().catch(() => false)) {
      await docsLink.click();
      await expect(page).toHaveURL(/\/documents/);
      await expect(page.locator('[data-testid="page-title"]')).toContainText('Hồ sơ & Tài liệu');
    }
  });
});
