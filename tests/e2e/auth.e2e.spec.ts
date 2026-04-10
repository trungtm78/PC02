/**
 * E2E Auth Flow Tests - PC02 Case Management System
 * TASK-2026-0225-001-STEP1
 *
 * These tests use Playwright to validate AC-STEP1-03 and AC-STEP1-04.
 * Run with: npx playwright test tests/e2e/auth.e2e.spec.ts
 */

import { test, expect, request } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';

// -----------------------------------------------------------------------
// AC-STEP1-01 / AC-STEP1-02: Backend & Frontend liveness
// -----------------------------------------------------------------------
test.describe('Infrastructure Health', () => {
  test('AC-STEP1-01: Backend NestJS responds on port 3000', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/health`);
    expect(response.status()).toBe(200);
  });

  test('AC-STEP1-02: Frontend Vite app serves on port 5173', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await expect(page).toHaveTitle(/PC02/);
  });
});

// -----------------------------------------------------------------------
// AC-STEP1-03: Login returns a valid JWT RS256 token
// -----------------------------------------------------------------------
test.describe('Auth API - Login', () => {
  test('POST /api/v1/auth/login returns 200 with accessToken and refreshToken', async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'admin@pc02.local', password: 'Admin@1234!' },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('expiresIn');

    // Validate JWT structure: 3 Base64URL segments separated by dots
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    expect(body.accessToken).toMatch(jwtRegex);

    // Decode header and assert RS256 algorithm
    const headerB64 = body.accessToken.split('.')[0];
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    expect(header.alg).toBe('RS256');
    expect(header.typ).toBe('JWT');
  });

  test('POST /api/v1/auth/login with wrong credentials returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'admin@pc02.local', password: 'wrong-password' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/v1/auth/login with missing fields returns 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'admin@pc02.local' },
    });
    expect(response.status()).toBe(400);
  });
});

// -----------------------------------------------------------------------
// Token Refresh
// -----------------------------------------------------------------------
test.describe('Auth API - Refresh Token', () => {
  test('POST /api/v1/auth/refresh returns new accessToken', async ({ request }) => {
    // Step 1: login to get refreshToken
    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'admin@pc02.local', password: 'Admin@1234!' },
    });
    const { refreshToken } = await loginRes.json();

    // Step 2: use refreshToken to get new accessToken
    const refreshRes = await request.post(`${BASE_URL}/api/v1/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refreshRes.status()).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody).toHaveProperty('accessToken');
  });

  test('POST /api/v1/auth/refresh with invalid token returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/refresh`, {
      data: { refreshToken: 'invalid.token.value' },
    });
    expect(response.status()).toBe(401);
  });
});

// -----------------------------------------------------------------------
// AC-STEP1-04: AuditLog records login action
// -----------------------------------------------------------------------
test.describe('Audit Log - Login Action', () => {
  test('AC-STEP1-04: Login action is recorded in audit log', async ({ request }) => {
    // Perform login
    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { username: 'admin@pc02.local', password: 'Admin@1234!' },
    });
    const { accessToken } = await loginRes.json();

    // Query audit log (admin endpoint)
    const auditRes = await request.get(`${BASE_URL}/api/v1/audit-logs?action=USER_LOGIN&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(auditRes.status()).toBe(200);
    const audit = await auditRes.json();
    expect(audit.data.length).toBeGreaterThan(0);
    expect(audit.data[0].action).toBe('USER_LOGIN');
    expect(audit.data[0].userId).toBeTruthy();
  });
});

// -----------------------------------------------------------------------
// Frontend Login UI Flow (Playwright browser test)
// -----------------------------------------------------------------------
test.describe('Frontend - Login UI', () => {
  test('Login page renders and accepts credentials', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);

    // Assert form elements exist (use input[type] selectors to avoid strict-mode clash with "Show password" button)
    await expect(page.locator('input[type="email"], input[id="username"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login|đăng nhập/i })).toBeVisible();
  });

  test('Successful login redirects to dashboard', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);

    await page.locator('input[type="email"], input[id="username"]').first().fill('admin@pc02.local');
    await page.locator('input[type="password"]').first().fill('Admin@1234!');
    await page.getByRole('button', { name: /sign in|login|đăng nhập/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/(dashboard|home|\/)/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Failed login shows error message', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);

    await page.locator('input[type="email"], input[id="username"]').first().fill('admin@pc02.local');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login|đăng nhập/i }).click();

    await expect(
      page.getByText(/invalid|incorrect|unauthorized|sai mật khẩu/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
