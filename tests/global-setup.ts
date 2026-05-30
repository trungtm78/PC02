/**
 * Global setup cho UAT runner — login 1 lần lấy JWT, lưu vào test-results/.auth-token.txt.
 * Tests read token từ file ở module init (process.env không propagate qua workers).
 */
import { request, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(_config: FullConfig): Promise<void> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const username = process.env.ADMIN_USERNAME || 'admin@pc02.local';
  const password = process.env.ADMIN_PASSWORD || '68@Love2love68';

  console.log(`[UAT global-setup] Login ${username} @ ${baseUrl}`);

  const ctx = await request.newContext({
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
  });

  let token = '';
  let userId = '';

  try {
    // PC02 backend DTO: { username, password } (not email)
    const resp = await ctx.post('/api/v1/auth/login', {
      data: { username, password },
      timeout: 15_000,
      failOnStatusCode: false,
    });
    if (resp.ok()) {
      const body = await resp.json();
      const data = body.data || body;
      token = data.accessToken || data.access_token || data.token || '';
      userId = data.user?.id || data.userId || '';
      console.log(`[UAT global-setup] Login OK — token len=${token.length}, userId=${userId}`);
    } else {
      const errBody = await resp.text();
      console.warn(`[UAT global-setup] Login HTTP ${resp.status()}: ${errBody.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.warn(`[UAT global-setup] Login error: ${e.message}`);
  } finally {
    await ctx.dispose();
  }

  const authDir = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, '.auth-token.txt'), token, 'utf-8');
  fs.writeFileSync(path.join(authDir, '.auth-userid.txt'), userId, 'utf-8');
  process.env.UAT_TOKEN = token;
  process.env.UAT_USER_ID = userId;
}

export default globalSetup;
