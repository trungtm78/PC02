import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useMenuSections, trungTenMuc } from '../useMenuSections';
import { FEATURE_MODULES } from '../featureRegistry';
import type { FeatureFlag } from '../types';

function co(key: string): FeatureFlag {
  return { key, label: key, description: null, enabled: true, domain: null, rolloutPct: 100 };
}
const batHet = (): FeatureFlag[] => FEATURE_MODULES.map((f) => co(f.manifest.key));

function Bao({ children }: { children: ReactNode }) {
  return <FeatureFlagsProvider initialFlags={batHet()}>{children}</FeatureFlagsProvider>;
}

function muc() {
  return renderHook(() => useMenuSections(), { wrapper: Bao }).result.current;
}

/**
 * Nhóm con KHÔNG được trùng tên với mục cha chứa nó.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, mở mục "Báo cáo & Thống kê" trong thanh bên thì thấy đúng hai thứ:
 *
 *     hien = ["Chỉ tiêu KPI", "Báo cáo & Thống kê"]
 *
 * Bấm tiếp vào cái thứ hai — trùng tên y hệt cái vừa bấm — mới ra 9 màn báo cáo:
 *
 *     ["Xuất hồ sơ đơn thư","Báo cáo tháng","Báo cáo quý","Thống kê phường/xã",
 *      "Hồ sơ quá hạn","Nhật ký hoạt động","Báo cáo TĐC","Thống kê 48 trường","Phụ lục 1-6 BCA"]
 *
 * Đường đi thật là "Báo cáo & Thống kê › Báo cáo & Thống kê › Báo cáo tháng". "Quy trình xử lý"
 * y hệt, che 4 màn nữa. Tổng cộng 13 màn dựng xong, có dữ liệu thật, nằm sau một lớp mà người
 * dùng đọc thấy đúng cái tên mình vừa bấm — phần lớn sẽ dừng ở đó.
 *
 * Nó cũng làm hỏng chính bộ dò tự động của phiên soát: bộ dò bấm theo tên nên cứ trúng lớp cha,
 * và suýt kết luận nhầm rằng 13 màn ấy "không có đường bấm tới".
 *
 * ── Vì sao sửa ở BỘ DỰNG chứ không đổi nhãn ──
 *
 * Nhóm ấy không có tên nào tốt hơn: nó gom đúng những thứ mà mục cha đã gom. Đổi tên là bịa ra
 * một tầng phân loại không có thật. Gỡ hẳn tầng thừa mới đúng — và làm ở bộ dựng thì mọi module
 * sau này bọc nhầm cũng tự phẳng, không ai phải nhớ luật.
 */
describe('Nhóm trùng tên mục cha bị gỡ tầng thừa', () => {
  it('mục "Báo cáo & Thống kê" KHÔNG chứa nhóm cùng tên', () => {
    const m = muc().find((s) => s.id === 'reports');
    expect(m).toBeDefined();
    expect(m!.items.map((i) => i.label)).not.toContain(m!.label);
  });

  it('mục "Quy trình xử lý" KHÔNG chứa nhóm cùng tên', () => {
    const m = muc().find((s) => s.id === 'workflow');
    expect(m).toBeDefined();
    expect(m!.items.map((i) => i.label)).not.toContain(m!.label);
  });

  /** Gỡ tầng thừa mà làm mất màn thì tệ hơn để nguyên — 9 màn báo cáo phải nổi lên đúng một cấp. */
  it('9 màn báo cáo nổi lên thẳng trong mục, bấm một lần là tới', () => {
    const m = muc().find((s) => s.id === 'reports')!;
    const nhan = m.items.map((i) => i.label);
    for (const t of [
      'Xuất hồ sơ đơn thư',
      'Báo cáo tháng',
      'Báo cáo quý',
      'Thống kê phường/xã',
      'Hồ sơ quá hạn',
      'Nhật ký hoạt động',
      'Báo cáo TĐC',
      'Thống kê 48 trường',
      'Phụ lục 1-6 BCA',
    ]) {
      expect(nhan).toContain(t);
    }
  });

  it('4 màn quy trình cũng nổi lên đúng một cấp', () => {
    const m = muc().find((s) => s.id === 'workflow')!;
    const nhan = m.items.map((i) => i.label);
    for (const t of ['Luân chuyển / Trả lại', 'Hướng dẫn nghiệp vụ', 'Trao đổi vụ án', 'Ủy quyền điều tra']) {
      expect(nhan).toContain(t);
    }
  });

  /** Các mục KHÁC không được đụng tới — chỉ gỡ đúng tầng trùng tên. */
  it('nhóm không trùng tên vẫn giữ nguyên tầng của nó', () => {
    const m = muc().find((s) => s.id === 'business')!;
    const vuAn = m.items.find((i) => i.label === 'Quản lý vụ án');
    expect(vuAn).toBeDefined();
    expect(vuAn!.children?.length ?? 0).toBeGreaterThan(0);
  });

  /**
   * Chốt lâu dài cho MỌI mục, kể cả module thêm sau này: không mục nào được chứa một mục con
   * mang đúng tên của chính nó.
   */
  it('không mục nào chứa mục con trùng tên chính nó', () => {
    for (const m of muc()) {
      expect(m.items.map((i) => i.label), `mục "${m.label}" chứa mục con trùng tên`).not.toContain(
        m.label,
      );
    }
  });
});

/**
 * Chốt "chỉ gỡ khi nhóm CÓ CON", ghim riêng.
 *
 * Gieo lỗi cho thấy: sau khi đổi nhãn mục dashboard, không ca nào còn chạm tới chốt ấy nữa —
 * gỡ nó đi mà bộ kiểm vẫn xanh. Một mục LÁ trùng tên là đường đi DUY NHẤT tới màn của nó; gỡ
 * đi là mất hẳn màn, im lặng. Phải có ca riêng, không dựa vào dữ liệu thật của kho.
 */
describe('trungTenMuc — chỉ gỡ nhóm, không gỡ mục lá', () => {
  const nhom = {
    section: 'reports' as const,
    id: 'x',
    label: 'Báo cáo & Thống kê',
    children: [{ section: 'reports' as const, id: 'y', label: 'Báo cáo tháng', path: '/r' }],
  };
  const la = { section: 'reports' as const, id: 'z', label: 'Báo cáo & Thống kê', path: '/r' };

  it('nhóm trùng tên và CÓ con thì gỡ', () => {
    expect(trungTenMuc(nhom)).toBe(true);
  });

  it('mục LÁ trùng tên thì GIỮ — gỡ đi là mất luôn màn ấy', () => {
    expect(trungTenMuc(la)).toBe(false);
  });

  it('nhóm có con nhưng KHÁC tên thì giữ nguyên tầng', () => {
    expect(trungTenMuc({ ...nhom, label: 'Báo cáo tài chính' })).toBe(false);
  });

  it('nhóm rỗng con thì không gỡ (không có gì để đẩy lên)', () => {
    expect(trungTenMuc({ ...nhom, children: [] })).toBe(false);
  });
});
