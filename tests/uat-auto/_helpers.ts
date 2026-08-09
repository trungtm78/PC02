/**
 * UAT helper — login + API request wrapper cho 781 TC.
 * Mọi spec import từ đây.
 */
import { APIRequestContext, expect } from '@playwright/test';

/**
 * Target deployment for the UAT suite.
 *
 * No default. This used to fall back to the production IP, so `npx playwright
 * test tests/uat-auto` with an empty environment aimed 781 test cases —
 * including writes — at the live system. An explicit BASE_URL is cheap; an
 * accidental production run is not.
 */
export function baseUrl(): string {
  const base = process.env.BASE_URL;
  if (!base) {
    throw new Error(
      'BASE_URL is not set. The UAT suite runs against a real deployment and has ' +
        'no default target — copy tests/.env.test.example to tests/.env.test and ' +
        'set BASE_URL (that file is gitignored, and UAT_PROD=1 goes in the shell).',
    );
  }
  return base;
}

export type Role = 'admin' | 'admin2' | 'officer1' | 'officer2' | 'approver1' | 'noauth';

export const CREDS: Record<Exclude<Role, 'noauth'>, { username: string; password: string }> = {
  admin: { username: process.env.ADMIN_USERNAME!, password: process.env.ADMIN_PASSWORD! },
  admin2: { username: process.env.ADMIN2_USERNAME!, password: process.env.ADMIN2_PASSWORD! },
  officer1: { username: process.env.OFFICER1_USERNAME!, password: process.env.OFFICER1_PASSWORD! },
  officer2: { username: process.env.OFFICER2_USERNAME!, password: process.env.OFFICER2_PASSWORD! },
  approver1: { username: process.env.APPROVER1_USERNAME!, password: process.env.APPROVER1_PASSWORD! },
};

const tokenCache = new Map<string, { token: string; ts: number }>();
const TOKEN_TTL_MS = 13 * 60 * 1000; // JWT exp ~15 phút, refresh sau 13'

export async function loginAs(role: Role, api: APIRequestContext): Promise<string> {
  if (role === 'noauth') return '';
  const cached = tokenCache.get(role);
  if (cached && Date.now() - cached.ts < TOKEN_TTL_MS) return cached.token;
  const c = CREDS[role];
  const res = await api.post(`${baseUrl()}/api/v1/auth/login`, {
    data: { username: c.username, password: c.password },
  });
  if (!res.ok()) {
    throw new Error(`Login fail ${role}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const token = body.accessToken || body.access_token || body.token;
  tokenCache.set(role, { token, ts: Date.now() });
  return token;
}

export interface CallOpts {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // relative to /api/v1
  role?: Role;
  body?: any;
  query?: Record<string, any>;
  expectedStatus: number | number[];
  tag?: string; // UAT-RUN-TC-XXX prefix cho cleanup
}

export async function call(api: APIRequestContext, opts: CallOpts) {
  const token = opts.role ? await loginAs(opts.role, api) : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let url = `${baseUrl()}/api/v1${opts.path}`;
  if (opts.query) {
    const qs = new URLSearchParams(opts.query as any).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await api.fetch(url, {
    method: opts.method,
    headers,
    data: opts.body !== undefined ? opts.body : undefined,
  });
  const status = res.status();
  // Cho phép 2xx interchangeable (200/201) — backend có thể trả khác nhau
  const expectedRaw = Array.isArray(opts.expectedStatus) ? opts.expectedStatus : [opts.expectedStatus];
  const expected = [...expectedRaw];
  if (expectedRaw.includes(200) && !expectedRaw.includes(201)) expected.push(201);
  if (expectedRaw.includes(201) && !expectedRaw.includes(200)) expected.push(200);
  const body = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(body); } catch {}
  expect(expected, `${opts.method} ${opts.path} → expected ${expected.join('/')}, got ${status}. Body: ${body.substring(0, 200)}`).toContain(status);
  return { status, body: parsed, raw: body };
}

/**
 * Tạo Case test với prefix UAT-RUN cho mỗi test chạy.
 * Trả về caseId. Cleanup không bắt buộc — soft delete có thể chạy sau.
 */
export async function createTestCase(api: APIRequestContext, opts?: {
  role?: Role; tag?: string; status?: string;
}): Promise<string> {
  const role = opts?.role || 'admin';
  const tag = opts?.tag || `UAT-RUN-${Date.now()}`;
  const token = await loginAs(role, api);
  const res = await api.fetch(`${baseUrl()}/api/v1/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: {
      name: `[${tag}] Test Case ${Date.now()}`,
      caseProvenance: 'DIRECT_DISCOVERY',
      crime: 'Test crime',
    },
  });
  if (!res.ok()) throw new Error(`createTestCase fail: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return body.data?.id || body.id;
}

/**
 * Smoke check endpoint trả về kết quả hợp lệ — không enforce status cụ thể.
 * Dùng cho A11Y/COMPAT/PERFORMANCE TC nơi không có expected status rõ.
 */
export async function smokeReachable(api: APIRequestContext, path: string, role: Role = 'admin') {
  const token = role !== 'noauth' ? await loginAs(role, api) : '';
  const res = await api.fetch(`${baseUrl()}/api/v1${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect([200, 201, 401, 403, 404]).toContain(res.status());
}
