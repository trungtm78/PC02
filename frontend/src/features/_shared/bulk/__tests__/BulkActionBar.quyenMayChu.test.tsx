/**
 * Nút thao tác hàng loạt hiện theo ĐÚNG luật máy chủ (rà mã PR #435, 20/09/2026):
 *  - Phân công hàng loạt: máy chủ dùng DispatchGuard (quyền điều phối hoặc ADMIN), KHÔNG cần quyền sửa. Trước đây nút
 *    gắn quyền `edit` → người điều phối thiếu edit bị ẩn nút dù được phép; cán bộ có edit thấy nút rồi nhận 403.
 *  - Khôi phục hàng loạt: máy chủ đòi `restore:<Subject>`, trước đây nút gắn `edit`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BulkActionBar } from '../BulkActionBar';
import { buildCasesAdapter } from '../adapters/cases';
import { buildIncidentsAdapter } from '../adapters/incidents';
import { buildPetitionsAdapter } from '../adapters/petitions';
import type { UseBulkSelectionResult } from '../useBulkSelection';

const quyen = { canDispatch: false, co: new Set<string>() };
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    hasPermission: (r: string, a: string) => quyen.co.has(`${a}:${r}`),
    canDispatch: quyen.canDispatch,
  }),
}));

const chon: UseBulkSelectionResult = {
  selectedIds: new Set(['x']),
  mode: 'page',
  count: 1,
  pageState: 'some',
  isSelected: () => true,
  toggleOne: vi.fn(),
  togglePage: vi.fn(),
  selectAllMatchingFilter: vi.fn(),
  clear: vi.fn(),
};

const BO = [
  ['Vụ án', 'cases', () => buildCasesAdapter({ enableAssign: true, enableRestore: true })],
  ['Vụ việc', 'incidents', () => buildIncidentsAdapter({ enableAssign: true, enableRestore: true })],
  ['Đơn thư', 'petitions', () => buildPetitionsAdapter({ enableAssign: true, enableRestore: true })],
] as const;

describe.each(BO)('%s — nút hàng loạt theo luật máy chủ', (_ten, taiNguyen, dung) => {
  beforeEach(() => {
    quyen.canDispatch = false;
    quyen.co = new Set();
  });

  const coNut = (nhan: RegExp) => screen.queryByRole('button', { name: nhan }) !== null;

  it('có quyền SỬA nhưng không điều phối → KHÔNG thấy Phân công', () => {
    quyen.co = new Set([`view:${taiNguyen}`, `edit:${taiNguyen}`]);
    render(<BulkActionBar selection={chon} adapter={dung() as never} pageRows={[]} />);
    expect(coNut(/Phân công/)).toBe(false);
  });

  it('điều phối (không cần quyền sửa) → thấy Phân công', () => {
    quyen.canDispatch = true;
    quyen.co = new Set([`view:${taiNguyen}`]);
    render(<BulkActionBar selection={chon} adapter={dung() as never} pageRows={[]} />);
    expect(coNut(/Phân công/)).toBe(true);
  });

  it('Khôi phục cần quyền restore — có edit thôi thì không thấy', () => {
    quyen.co = new Set([`edit:${taiNguyen}`]);
    const { unmount } = render(<BulkActionBar selection={chon} adapter={dung() as never} pageRows={[]} />);
    expect(coNut(/Khôi phục/)).toBe(false);
    unmount();
    quyen.co = new Set([`restore:${taiNguyen}`]);
    render(<BulkActionBar selection={chon} adapter={dung() as never} pageRows={[]} />);
    expect(coNut(/Khôi phục/)).toBe(true);
  });
});
