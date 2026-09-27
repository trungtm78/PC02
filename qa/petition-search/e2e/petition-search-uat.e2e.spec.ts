import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { petitionSearchCases } from '../petition-search-cases';

const fixture = JSON.parse(readFileSync('test-results/petition-local/runtime.json', 'utf8'));

test('user finds every list column using global search and Enter', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Tài khoản đăng nhập').fill(fixture.username);
  await page.getByLabel('Mật khẩu', { exact: false }).first().fill(fixture.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);

  for (const item of petitionSearchCases) {
    await test.step(item.key, async () => {
      await page.goto('/petitions');
      const search = page.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
      await expect(search).toBeVisible();
      await search.click();
      await search.fill(item.query);
      await expect(page.getByTestId('the-tim-kiem')).toHaveCount(0);
      await search.press('Enter');
      await expect(page.getByTestId('the-tim-kiem')).toHaveCount(1);
      await expect(page.getByRole('row').filter({ hasText: 'Searchsender' })).toHaveCount(1);
    });
  }
  await test.step('information-type suggestion and hidden-column search', async () => {
    await page.goto('/petitions');
    const search = page.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await search.click();
    await search.fill('searchtype');
    await page.getByRole('option').filter({ hasText: 'Loại thông tin' }).click();
    await expect(page.getByTestId('the-tim-kiem')).toContainText('Loại thông tin');
    await expect(page.getByRole('row').filter({ hasText: 'Searchsender' })).toHaveCount(1);
    await page.getByRole('button', { name: /^Cột/ }).click();
    await page.getByRole('checkbox', { name: /Loại thông tin/ }).uncheck();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Loại thông tin' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Searchsender' })).toHaveCount(1);
    await page.goto('/petitions');
    await search.click();
    await search.fill('searchtype');
    await search.press('Enter');
    await expect(page.getByRole('row').filter({ hasText: 'Searchsender' })).toHaveCount(1);
    await page.getByRole('button', { name: /Bộ lọc/ }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất Excel (đang xem)', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
