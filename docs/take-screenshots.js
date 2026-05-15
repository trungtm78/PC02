const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:3000/api/v1';
const IMG  = path.join(__dirname, 'images');
const CREDS = {
  username: process.env.SCREENSHOT_USERNAME || 'admin@pc02.local',
  password: process.env.SCREENSHOT_PASSWORD,
};
if (!CREDS.password) {
  console.error('ERROR: set SCREENSHOT_PASSWORD env var before running.');
  process.exit(1);
}

if (!fs.existsSync(IMG)) fs.mkdirSync(IMG, { recursive: true });

async function ss(page, name) {
  const file = path.join(IMG, name);
  await page.screenshot({ path: file, fullPage: false });
  const size = fs.statSync(file).size;
  console.log(`✓ ${name} (${(size/1024).toFixed(0)} KB)`);
}

async function waitLoad(page, timeout = 4000) {
  try { await page.waitForLoadState('networkidle', { timeout }); } catch {}
}

function apiLogin() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: CREDS.username, password: CREDS.password });
    const req = http.request(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // Step 1: Login via API to get tokens
  console.log('Logging in via API...');
  const loginResp = await apiLogin();
  if (!loginResp.accessToken) {
    console.error('Login failed:', JSON.stringify(loginResp));
    process.exit(1);
  }
  const { accessToken, refreshToken } = loginResp;
  console.log('Login OK, token acquired');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // ── 1. LOGIN PAGE (before auth) ──────────────────────────────────
  await page.goto(`${BASE}/login`);
  await waitLoad(page);
  await ss(page, '01-login.png');

  // Inject tokens into browser storage so app thinks we're logged in
  await page.evaluate(({ at, rt }) => {
    sessionStorage.setItem('accessToken', at);
    localStorage.setItem('refreshToken', rt);
  }, { at: accessToken, rt: refreshToken });

  // Fill form for screenshot then take filled screenshot
  await page.fill('#username', CREDS.username);
  await page.fill('#password', CREDS.password);
  await ss(page, '02-login-filled.png');

  // Navigate to dashboard (tokens already set)
  await page.goto(`${BASE}/dashboard`);
  await waitLoad(page, 6000);
  console.log('Dashboard URL:', page.url());

  // ── 2. DASHBOARD ────────────────────────────────────────────────
  await ss(page, '03-dashboard.png');

  // ── 3. CASES ────────────────────────────────────────────────────
  await page.goto(`${BASE}/cases`);
  await waitLoad(page, 5000);
  await ss(page, '04-cases.png');

  // Click first case row
  const caseRow = page.locator('tbody tr').first();
  if (await caseRow.count() > 0) {
    await caseRow.click();
    await waitLoad(page, 4000);
    await ss(page, '04b-case-detail.png');
    await page.goBack();
    await waitLoad(page, 2000);
  }

  // ── 4. INCIDENTS ────────────────────────────────────────────────
  await page.goto(`${BASE}/incidents`);
  await waitLoad(page, 5000);
  await ss(page, '05-incidents.png');

  const incRow = page.locator('tbody tr').first();
  if (await incRow.count() > 0) {
    await incRow.click();
    await waitLoad(page, 4000);
    await ss(page, '05b-incident-detail.png');
    await page.goBack();
    await waitLoad(page, 2000);
  }

  // ── 5. PETITIONS ────────────────────────────────────────────────
  await page.goto(`${BASE}/petitions`);
  await waitLoad(page, 5000);
  await ss(page, '06-petitions.png');

  const petRow = page.locator('tbody tr').first();
  if (await petRow.count() > 0) {
    await petRow.click();
    await waitLoad(page, 4000);
    await ss(page, '06b-petition-detail.png');
    await page.goBack();
    await waitLoad(page, 2000);
  }

  // ── 6. KPI ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/kpi`);
  await waitLoad(page, 8000);
  await ss(page, '07-kpi.png');

  // ── 7. REPORTS ──────────────────────────────────────────────────
  await page.goto(`${BASE}/export-reports`).catch(() => {});
  await waitLoad(page, 4000);
  await ss(page, '08-reports.png');

  // ── 8. ADMIN - USERS ────────────────────────────────────────────
  await page.goto(`${BASE}/nguoi-dung`);
  await waitLoad(page, 4000);
  await ss(page, '09-admin-users.png');

  // ── 9. ADMIN - TEAMS ────────────────────────────────────────────
  await page.goto(`${BASE}/to-nhom`);
  await waitLoad(page, 4000);
  await ss(page, '10-admin-teams.png');

  // ── 10. ADMIN - SYSTEM SETTINGS ─────────────────────────────────
  await page.goto(`${BASE}/admin/settings`).catch(() => {});
  await waitLoad(page, 3000);
  await ss(page, '11-admin-settings.png');

  // ── 11. CREATE CASE MODAL ───────────────────────────────────────
  await page.goto(`${BASE}/cases`);
  await waitLoad(page, 4000);
  const createBtn = page.locator('button').filter({ hasText: /tạo|thêm|new|create/i }).first();
  if (await createBtn.count() > 0) {
    await createBtn.click();
    await waitLoad(page, 2000);
    await ss(page, '12-create-case.png');
  }

  await browser.close();

  console.log('\nAll screenshots saved to:', IMG);
  const files = fs.readdirSync(IMG).filter(f => f.endsWith('.png')).sort();
  files.forEach(f => {
    const size = fs.statSync(path.join(IMG, f)).size;
    console.log(`  ${f}: ${(size/1024).toFixed(0)} KB`);
  });
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
