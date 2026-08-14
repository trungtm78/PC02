/**
 * UAT Đợt 1 — ma trận phân quyền, phần kiểm được ở mức API.
 *
 * Hồi quy nguy hiểm nhất của đợt này không phải "màn hình hiển thị sai". Nó là:
 * ma trận nạp về **rỗng**, người dùng thấy một bảng trống, bấm Lưu, và bản ghi
 * rỗng đó **ghi đè toàn bộ quyền của vai trò**. Không có ngoại lệ nào, không có
 * cảnh báo nào — chỉ có một hệ thống mà hôm sau không ai làm được gì.
 *
 * Vì thế `UAT-COVERAGE.md` yêu cầu chạy
 * `SELECT * FROM audit_logs WHERE action='ROLE_PERMISSIONS_UPDATED'` trên
 * production TRƯỚC khi merge. Bộ này không thay được bước đó — nó chặn nguyên
 * nhân, còn câu SQL kia phát hiện thiệt hại đã xảy ra.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API = process.env.API_URL || 'http://localhost:3000';

function adminToken(): string {
  const p = path.resolve(__dirname, '../../test-results/.auth-token.txt');
  if (!fs.existsSync(p)) {
    throw new Error(`Không có token admin tại ${p}. Chạy qua playwright global-setup.`);
  }
  return fs.readFileSync(p, 'utf-8').trim();
}

async function api() {
  return pwRequest.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken()}` },
    ignoreHTTPSErrors: true,
  });
}

/** Bóc mảng ra khỏi vỏ `{success, data}` hoặc mảng trần. */
function unwrap(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const d = (body as { data?: unknown }).data;
  if (Array.isArray(d)) return d;
  const dd = (d as { data?: unknown })?.data;
  return Array.isArray(dd) ? dd : [];
}

test.describe('Đợt 1 — ma trận phân quyền', () => {
  test('danh mục quyền không rỗng — nếu rỗng thì ma trận vẽ ra bảng trống', async () => {
    const ctx = await api();
    const res = await ctx.get('/api/v1/admin/permissions');

    expect(res.status()).toBe(200);
    expect(
      unwrap(await res.json()).length,
      'danh mục quyền rỗng ⇒ ma trận hiện bảng trống ⇒ bấm Lưu là xoá sạch quyền',
    ).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('MỌI vai trò trả về quyền hiện có, không vai trò nào rỗng', async () => {
    // Kiểm từng vai trò chứ không lấy mẫu: chỉ cần MỘT vai trò nạp về rỗng là
    // đủ để người quản trị mở đúng vai trò đó, thấy bảng trống, và bấm Lưu.
    const ctx = await api();
    const roles = unwrap(await (await ctx.get('/api/v1/admin/roles')).json()) as Array<{
      id: string;
      name?: string;
    }>;
    expect(roles.length, 'không có vai trò nào — seed chưa chạy?').toBeGreaterThan(0);

    const empty: string[] = [];
    for (const role of roles) {
      const res = await ctx.get(`/api/v1/admin/roles/${role.id}/permissions`);
      if (res.status() !== 200 || unwrap(await res.json()).length === 0) {
        empty.push(role.name ?? role.id);
      }
    }

    expect(empty, 'vai trò nạp về quyền rỗng — mở ra và bấm Lưu là mất quyền').toEqual(
      [],
    );
    await ctx.dispose();
  });

  test('quyền trả về có đủ hình dạng `{action, subject}` mà FE cần', async () => {
    // Ánh xạ quyền của FE (`permission-mapping.ts`) dịch từ vựng BE sang từ vựng
    // FE. Thiếu một trong hai trường thì mọi ô trong ma trận về `false` — trông
    // y hệt "vai trò này chưa có quyền gì".
    const ctx = await api();
    const roles = unwrap(await (await ctx.get('/api/v1/admin/roles')).json()) as Array<{
      id: string;
    }>;
    const perms = unwrap(
      await (await ctx.get(`/api/v1/admin/roles/${roles[0].id}/permissions`)).json(),
    ) as Array<Record<string, unknown>>;

    for (const p of perms.slice(0, 5)) {
      expect(typeof p.action, `thiếu 'action' ⇒ ô ma trận về false`).toBe('string');
      expect(typeof p.subject, `thiếu 'subject' ⇒ ô ma trận về false`).toBe('string');
    }
    await ctx.dispose();
  });
});
