// Auto-generated data factory by uat-test-runner skill
// Generated: 2026-05-31T01:25:15.266219
// Total fixtures: 1

import { request, APIRequestContext } from '@playwright/test';

const API_BASE = process.env.BASE_URL || 'http://localhost:3000';

export interface FixtureCtx {
  [key: string]: any;
}

export interface FixtureResult {
  fixture_id: string;
  [key: string]: any;
}

// === Helper functions ===

function randomHex(len = 8): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysOffsetISO(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

// Shared API request context
let _apiContext: APIRequestContext | null = null;

async function apiRequest(method: string, path: string, payload?: any, headers?: any) {
  if (!_apiContext) {
    _apiContext = await request.newContext({ baseURL: API_BASE });
  }
  const url = path.startsWith('http') ? path : path;
  const options: any = { headers: headers || {} };
  if (payload && ['post', 'put', 'patch'].includes(method)) {
    options.data = payload;
  }
  // @ts-ignore — dynamic method dispatch
  const response = await _apiContext[method](url, options);
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return {
    ok: response.ok(),
    status: response.status(),
    body,
  };
}

// SQL helper (stub — implement nếu cần)
async function getDbConnection(connStr?: string): Promise<any> {
  throw new Error('SQL fixture setup requires DB driver. Install pg/mysql2 và implement getDbConnection.');
}

// === Setup functions ===

/**
 * Setup fixture: ⚠️ Chưa có fixture nào define
 * 
 * State:  | Lifecycle:  | Shape: 
 */
export async function setup⚠️ Chưa có fixture nào define(ctx: FixtureCtx = {}): Promise<FixtureResult> {
  const path = "";
  const response = await apiRequest('post', path, {});
  if (!response.ok) {
    throw new Error(`Setup fixture ⚠️ Chưa có fixture nào define failed: ${response.status} ${response.body}`);
  }
  const body = response.body;
  const fixture: FixtureResult = {
    fixture_id: "⚠️ Chưa có fixture nào define",
    _raw: body,
  };
  console.log(`✅ Setup fixture: ⚠️ Chưa có fixture nào define →`, fixture);
  return fixture;
}

// === Cleanup functions ===



// === Dispatch map ===

export const setupFixture: Record<string, (ctx?: FixtureCtx) => Promise<FixtureResult>> = {
  "⚠️ Chưa có fixture nào define": setup⚠️ Chưa có fixture nào define,
};

export const cleanupFixture: Record<string, (ctx: FixtureCtx) => Promise<void>> = {

};

// === Convenience: setup multi fixtures + return combined context ===

export async function setupFixtures(fixtureIds: string[]): Promise<FixtureCtx> {
  const ctx: FixtureCtx = {};
  for (const fid of fixtureIds) {
    const fn = setupFixture[fid];
    if (!fn) {
      console.warn(`⚠️ Unknown fixture: ${fid}`);
      continue;
    }
    const result = await fn(ctx);
    // Merge result fields into ctx (without overwriting prefix conflict)
    Object.assign(ctx, result);
    // Also expose nested by fixture_id
    ctx[fid] = result;
  }
  return ctx;
}

export async function cleanupFixtures(fixtureIds: string[], ctx: FixtureCtx): Promise<void> {
  // Cleanup in reverse order (last setup, first cleanup)
  for (const fid of [...fixtureIds].reverse()) {
    const fn = cleanupFixture[fid];
    if (!fn) continue;
    await fn(ctx[fid] || ctx);
  }
}
