/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';

// Đọc thẳng bằng Node: Vite chặn `?raw` ngoài thư mục frontend, và mở `server.fs.allow` ra thư mục cha
// thì máy chủ dev phục vụ được cả `backend/.env`.
// (Không dùng `new URL(…, import.meta.url)`: Vite biến mẫu ấy thành lượt nạp tài nguyên và chặn lại.)
const THU_MUC_NAY = dirname(fileURLToPath(import.meta.url));
const tepMayChu = (duong: string) =>
  readFileSync(resolve(THU_MUC_NAY, '../../../../backend/src', duong), 'utf8');
const xuatDonThu = tepMayChu('petitions/xuat-danh-sach-don-thu.ts');
const xuatVuAn = tepMayChu('cases/xuat-danh-sach-vu-an.ts');
const xuatVuViec = tepMayChu('incidents/xuat-danh-sach-vu-viec.ts');

/**
 * CỔNG hai phía: mỗi cột HIỆN ĐƯỢC trên bảng phải có khai cột xuất Excel ở máy chủ với CÙNG khoá, và
 * ngược lại. Nút "Xuất Excel" gửi khoá các cột đang hiện; thiếu khai ở máy chủ là 400 ngay khi cán bộ bật
 * cột ấy lên (18/09/2026 — bộ xuất theo bộ lọc).
 */
const MAN = [
  ['Đơn thư', donThu, xuatDonThu, 'KHAI_COT_XUAT_DON_THU'],
  ['Vụ án', vuAn, xuatVuAn, 'KHAI_COT_XUAT_VU_AN'],
  ['Vụ việc', vuViec, xuatVuViec, 'KHAI_COT_XUAT_VU_VIEC'],
] as const;

/** Khoá cột dữ liệu trên bảng (bỏ cột thao tác). */
function khoaBang(src: string): string[] {
  return [...src.matchAll(/^\s+key: '(\w+)',/gm)].map((m) => m[1]).filter((k) => k !== 'actions');
}

/**
 * Khoá trong ĐÚNG khối khai cột danh sách (`export const <TEN>: …` tới khối `export const` kế tiếp). Tệp còn
 * khai cột riêng cho tệp phường/xã — không thuộc danh sách chính.
 */
function khoaXuat(src: string, ten: string): string[] {
  const dau = src.indexOf(`export const ${ten}:`);
  if (dau < 0) return [];
  const sau = src.indexOf('export const ', dau + 1);
  const khoi = src.slice(dau, sau < 0 ? undefined : sau);
  return [...khoi.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
}

describe('CỔNG khai cột xuất — khoá bảng ↔ khoá xuất', () => {
  it.each(MAN)('%s: cùng một tập khoá', (_ten, bang, tepXuat, tenKhai) => {
    const xuat = khoaXuat(tepXuat, tenKhai);
    expect(xuat.length).toBeGreaterThan(5);
    expect([...khoaBang(bang)].sort()).toEqual([...xuat].sort());
  });

  it('gieo lỗi: thêm cột trên bảng mà quên khai xuất → cổng bắt được', () => {
    const xuat = khoaXuat(xuatDonThu, 'KHAI_COT_XUAT_DON_THU');
    expect([...khoaBang(donThu), 'cotMoi'].sort()).not.toEqual([...xuat].sort());
  });

  it('gieo lỗi: đọc nhầm cả khối khai phường → lệch tập khoá, cổng bắt được', () => {
    const caTep = [...xuatDonThu.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
    expect([...khoaBang(donThu)].sort()).not.toEqual([...caTep].sort());
  });
});
