/**
 * Thanh bên ẩn mục mà tài khoản không dùng được (20/09/2026). Trước đây thanh bên chỉ lọc theo cờ tính năng: mọi
 * cán bộ thấy cả mục Quản trị ("Khôi phục dữ liệu", "Người dùng"...), bấm vào mới thấy lời chặn hoặc 403.
 * Mục khai `quyen` (khoá máy chủ 'action:Subject', có MỘT là đủ) — cùng nguồn PermissionsGuard.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useMenuSections, locMucTheoQuyen } from '../useMenuSections';
import { FEATURE_MODULES } from '../featureRegistry';
import type { FeatureMenuEntry } from '../moduleTypes';
import { authStore, type AuthUser } from '@/stores/auth.store';

const muc = (id: string, o: Partial<FeatureMenuEntry> = {}): FeatureMenuEntry => ({
  section: 'admin',
  id,
  label: id,
  path: `/${id}`,
  ...o,
});
const co = (ds: string[]) => (k: string) => ds.includes(k);

describe('locMucTheoQuyen', () => {
  it('không khai quyen → luôn hiện', () => {
    expect(locMucTheoQuyen([muc('a')], co([])).map((m) => m.id)).toEqual(['a']);
  });

  it('có MỘT trong các quyền khai → hiện; không có quyền nào → ẩn', () => {
    const ds = [muc('kp', { quyen: ['restore:Case', 'restore:Petition'] })];
    expect(locMucTheoQuyen(ds, co(['restore:Petition'])).map((m) => m.id)).toEqual(['kp']);
    expect(locMucTheoQuyen(ds, co(['read:Case']))).toEqual([]);
  });

  it('lọc cả mục con; nhóm không đường dẫn mà hết con → bỏ luôn nhóm', () => {
    const nhom = muc('nhom', {
      path: undefined,
      children: [muc('c1', { quyen: ['read:User'] }), muc('c2', { quyen: ['write:Setting'] })],
    });
    const [conLai] = locMucTheoQuyen([nhom], co(['read:User']));
    expect(conLai.children!.map((m) => m.id)).toEqual(['c1']);
    expect(locMucTheoQuyen([nhom], co([]))).toEqual([]);
  });

  it('nhóm CÓ đường dẫn riêng mà hết con → vẫn giữ (vẫn là một trang)', () => {
    const nhom = muc('nhom', { children: [muc('c1', { quyen: ['read:User'] })] });
    expect(locMucTheoQuyen([nhom], co([])).map((m) => m.id)).toEqual(['nhom']);
  });
});

function Probe() {
  const sections = useMenuSections();
  const admin = sections.find((s) => s.id === 'admin');
  return <p data-testid="admin">{admin ? admin.items.map((i) => i.id).join(',') : '(không có mục Quản trị)'}</p>;
}
const flags = () =>
  FEATURE_MODULES.map((f) => ({
    key: f.manifest.key,
    label: f.manifest.key,
    description: null,
    enabled: true,
    domain: null,
    rolloutPct: 100,
  }));
const hoSo = (permissions?: string[]): AuthUser =>
  ({ id: 'u', email: 'u@x', username: 'u', role: 'OFFICER', permissions }) as AuthUser;

describe('useMenuSections — theo quyền thật', () => {
  afterEach(() => sessionStorage.clear());

  it('cán bộ không có restore:* → không thấy "Khôi phục dữ liệu"', () => {
    authStore.setProfile(hoSo(['read:Case']));
    render(
      <FeatureFlagsProvider initialFlags={flags()}>
        <Probe />
      </FeatureFlagsProvider>,
    );
    expect(screen.getByTestId('admin').textContent).not.toContain('admin-restore');
  });

  it('có restore:Petition → thấy "Khôi phục dữ liệu"', () => {
    authStore.setProfile(hoSo(['restore:Petition']));
    render(
      <FeatureFlagsProvider initialFlags={flags()}>
        <Probe />
      </FeatureFlagsProvider>,
    );
    expect(screen.getByTestId('admin').textContent).toContain('admin-restore');
  });

  it('hồ sơ chưa có danh sách quyền (chỉ JWT) → như trước: hiện, máy chủ vẫn chặn', () => {
    authStore.setProfile(hoSo(undefined));
    render(
      <FeatureFlagsProvider initialFlags={flags()}>
        <Probe />
      </FeatureFlagsProvider>,
    );
    expect(screen.getByTestId('admin').textContent).toContain('admin-restore');
  });
});
