/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_MODULES } from '../featureRegistry';
import type { FeatureMenuEntry } from '../moduleTypes';

/**
 * CỔNG quyền thanh bên (20/09/2026): khoá `quyen` khai ở mục menu phải là quyền CÓ THẬT của máy chủ. Gõ sai một chữ
 * (vd 'read:Cases') thì không vai trò nào có → mục biến mất với mọi người, kể cả quản trị, mà không ca kiểm nào đỏ.
 * Nguồn: `backend/prisma/seed-permissions.ts` — bảng quyền duy nhất mà mọi `@RequirePermissions` phải có mặt.
 */
const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const seed = readFileSync(resolve(GOC, 'backend/prisma/seed-permissions.ts'), 'utf8');
const QUYEN_MAY_CHU = new Set(
  [...seed.matchAll(/action:\s*'([^']+)',\s*subject:\s*'([^']+)'/g)].map((m) => `${m[1]}:${m[2]}`),
);

function moiMuc(ds: readonly FeatureMenuEntry[]): FeatureMenuEntry[] {
  return ds.flatMap((m) => [m, ...moiMuc(m.children ?? [])]);
}
const MUC = FEATURE_MODULES.flatMap((f) => moiMuc(f.menu ?? []));

describe('CỔNG quyền thanh bên', () => {
  it('đọc được bảng quyền máy chủ (tránh cổng xanh vì đọc rỗng)', () => {
    expect(QUYEN_MAY_CHU.size).toBeGreaterThan(40);
    expect(QUYEN_MAY_CHU.has('restore:Case')).toBe(true);
  });

  it('mọi khoá `quyen` trong menu đều có trong bảng quyền máy chủ', () => {
    const sai = MUC.flatMap((m) => (m.quyen ?? []).filter((q) => !QUYEN_MAY_CHU.has(q)).map((q) => `${m.id}: ${q}`));
    expect(sai).toEqual([]);
  });

  it('gieo lỗi: khoá gõ sai bị bắt', () => {
    expect(QUYEN_MAY_CHU.has('read:Cases')).toBe(false);
  });

  it('các màn nghiệp vụ chính đều đã khai quyền (không để sót khi thêm màn mới)', () => {
    const coDuong = MUC.filter((m) => m.path);
    // Mở cho mọi người đã đăng nhập theo đúng máy chủ (không @RequirePermissions) hoặc chặn theo VAI TRÒ trong mã.
    const KHONG_KHAI = new Set([
      '/reports/stat48',
      '/don-vi-hanh-chinh',
      '/admin/di-tru-du-lieu',
    ]);
    const sot = coDuong.filter((m) => !m.quyen?.length && !KHONG_KHAI.has(m.path!)).map((m) => `${m.id} ${m.path}`);
    expect(sot).toEqual([]);
  });
});
