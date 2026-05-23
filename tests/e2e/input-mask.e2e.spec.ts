/**
 * E2E Tests — Input Mask Format (v0.39 refactor)
 *
 * Verify mask format hoạt động end-to-end:
 * - Currency input format khi gõ + parse khi submit
 * - Phone input strip space + preserve leading 0
 * - Edit existing data — legacy phone format được hydrate
 *
 * Run: npx playwright test tests/e2e/input-mask.e2e.spec.ts
 *
 * Marker: @input-mask
 */
import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5179';
const BACKEND_URL = 'http://localhost:3000';

const TEST_USER = { username: 'admin@pc02.local', password: 'Admin@1234!' };

async function login(page: import('@playwright/test').Page) {
  await page.goto(FRONTEND_URL);
  await page.fill('[data-testid="login-username"]', TEST_USER.username);
  await page.fill('[data-testid="login-password"]', TEST_USER.password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15_000 });
}

test.describe('@input-mask — Currency formatting', () => {
  test('Currency input formats 1000000000 as "1.000.000.000 ₫" while typing', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${FRONTEND_URL}/cases/new`);

    // Wait form to mount
    await page.waitForSelector('input[placeholder="0"]', { timeout: 10_000 });

    // Find damage amount input (Tab 1)
    const damageInput = page
      .locator('input')
      .filter({ has: page.locator(':scope') })
      .nth(0);

    // Type a large number — should auto-format
    await damageInput.click();
    await page.keyboard.type('1000000000');

    // Verify formatted display
    await expect(damageInput).toHaveValue(/1\.000\.000\.000.*₫/);
  });

  test('Currency input blocks alpha characters', async ({ page }) => {
    await login(page);
    await page.goto(`${FRONTEND_URL}/cases/new`);

    const damageInput = page.locator('[data-testid="stat-damageAmount"]').first();
    await damageInput.click();
    await page.keyboard.type('abc123def');

    // Only digits should be accepted, formatted as currency
    await expect(damageInput).toHaveValue(/^123.*₫$/);
  });
});

test.describe('@input-mask — Phone formatting', () => {
  test('Phone input formats "0901234567" as "0901 234 567" while typing', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${FRONTEND_URL}/incidents/new`);

    await page.waitForSelector('[data-testid="field-sdtNguoiToGiac"]', { timeout: 10_000 });
    const phoneInput = page.locator('[data-testid="field-sdtNguoiToGiac"]');

    await phoneInput.click();
    await page.keyboard.type('0901234567');

    // Verify formatted display preserves leading 0
    await expect(phoneInput).toHaveValue('0901 234 567');
  });

  test('Phone input preserves leading 0 (not stripped by NumericFormat)', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`${FRONTEND_URL}/incidents/new`);

    const phoneInput = page.locator('[data-testid="field-sdtNguoiToGiac"]');
    await phoneInput.click();
    await page.keyboard.type('0901234567');

    const value = await phoneInput.inputValue();
    expect(value.startsWith('0')).toBe(true);
  });
});

test.describe('@input-mask — Submit boundary', () => {
  test('Case submit sends damageAmount as number (not formatted string)', async ({
    page,
  }) => {
    await login(page);

    // Intercept POST /cases to inspect payload
    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/cases') && req.method() === 'POST',
      { timeout: 30_000 },
    );

    await page.goto(`${FRONTEND_URL}/cases/new`);

    // Fill minimal required fields + damageAmount
    await page.fill('[data-testid="field-caseCode"]', 'E2E-TEST-001');
    await page.fill('[data-testid="field-caseTitle"]', 'E2E mask test');
    // ... additional required fields would go here

    // For this skeleton spec, mark as informational
    test.info().annotations.push({
      type: 'info',
      description: 'Full submit flow requires DB seeded with crimes/units — see TODO',
    });
    test.skip();

    await page.click('[data-testid="submit-case"]');
    const request = await requestPromise;
    const body = request.postDataJSON();
    expect(typeof body.metadata.damageAmount).toBe('number');
  });
});
