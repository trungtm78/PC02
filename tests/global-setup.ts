/**
 * Global setup cho UAT runner — login 1 lần lấy JWT, lưu vào test-results/.auth-token.txt.
 * Tests read token từ file ở module init (process.env không propagate qua workers).
 */
import { request, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(_config: FullConfig): Promise<void> {
  // UAT_PROD=1 bắt buộc — không login với credentials thật khi chạy local dev tests
  if (!process.env.UAT_PROD) return;

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const username = process.env.ADMIN_USERNAME || 'admin@pc02.local';
  const password = process.env.ADMIN_PASSWORD || '68@Love2love68';

  console.log(`[UAT global-setup] Login ${username} @ ${baseUrl}`);

  const ctx = await request.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
  });

  let token = '';

  const authDir = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(authDir, { recursive: true });

  const loginAs = async (user: string, pass: string): Promise<string> => {
    try {
      const resp = await ctx.post('/api/v1/auth/login', {
        data: { username: user, password: pass },
        timeout: 15_000,
        failOnStatusCode: false,
      });
      if (resp.ok()) {
        const body = await resp.json();
        const d = body.data || body;
        return d.accessToken || d.access_token || d.token || '';
      }
    } catch (_e) {}
    return '';
  };

  try {
    // Login admin (primary token cho API smoke tests)
    token = await loginAs(username, password);
    if (token) {
      console.log(`[UAT global-setup] Admin login OK — token len=${token.length}`);
    } else {
      console.warn('[UAT global-setup] Admin login failed — kiểm tra username/password field');
    }

    // Pre-fetch tokens cho 4 roles còn lại, lưu vào files riêng
    const extraAccounts = [
      { key: 'admin2', user: process.env.ADMIN2_USERNAME || 'admin2@pc02.local', pass: process.env.ADMIN2_PASSWORD || 'isP$sT4N@o71' },
      { key: 'officer1', user: process.env.OFFICER1_USERNAME || 'officer1@pc02.local', pass: process.env.OFFICER1_PASSWORD || '8I@&5c1gHmfy' },
      { key: 'officer2', user: process.env.OFFICER2_USERNAME || 'officer2@pc02.local', pass: process.env.OFFICER2_PASSWORD || '4TMa3hq*x3$v' },
      { key: 'approver1', user: process.env.APPROVER1_USERNAME || 'approver1@pc02.local', pass: process.env.APPROVER1_PASSWORD || '6!rrw@ILte62' },
    ];
    for (const acc of extraAccounts) {
      const t = await loginAs(acc.user, acc.pass);
      if (t) {
        fs.writeFileSync(path.join(authDir, `.auth-token-${acc.key}.txt`), t, 'utf-8');
        console.log(`[UAT global-setup] ${acc.key} login OK — token len=${t.length}`);
      }
    }
  } catch (e: any) {
    console.warn(`[UAT global-setup] Error: ${e.message}`);
  } finally {
    await ctx.dispose();
  }

  fs.writeFileSync(path.join(authDir, '.auth-token.txt'), token, 'utf-8');
  process.env.UAT_TOKEN = token;
}

export default globalSetup;
