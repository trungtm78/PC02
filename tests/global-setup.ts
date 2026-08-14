/**
 * Global setup cho UAT runner — login 1 lần lấy JWT, lưu vào test-results/.auth-token.txt.
 * Tests read token từ file ở module init (process.env không propagate qua workers).
 */
import { request, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Read a required credential, failing with a message that says how to fix it. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[UAT global-setup] ${name} is not set. UAT runs against a real deployment, ` +
        'so credentials must come from the environment: copy tests/.env.test.example ' +
        'to tests/.env.test and fill it in (that file is gitignored).',
    );
  }
  return value;
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // UAT_PROD=1 bắt buộc — không login với credentials thật khi chạy local dev tests
  if (!process.env.UAT_PROD) return;

  // No credential defaults. A password baked into a source file is a password
  // committed to the repo, and a default that silently works is one nobody
  // notices is being used. Copy tests/.env.test.example to tests/.env.test.
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const username = requireEnv('ADMIN_USERNAME');
  const password = requireEnv('ADMIN_PASSWORD');

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

    // Pre-fetch tokens cho 4 roles còn lại, lưu vào files riêng.
    // Accounts without credentials in the environment are skipped rather than
    // attempted with a built-in password.
    const extraAccounts: Array<{ key: string; user: string; pass: string }> = [];
    for (const [key, prefix] of [
      ['admin2', 'ADMIN2'],
      ['officer1', 'OFFICER1'],
      ['officer2', 'OFFICER2'],
      ['approver1', 'APPROVER1'],
    ]) {
      const user = process.env[`${prefix}_USERNAME`];
      const pass = process.env[`${prefix}_PASSWORD`];
      if (user && pass) extraAccounts.push({ key, user, pass });
    }

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
