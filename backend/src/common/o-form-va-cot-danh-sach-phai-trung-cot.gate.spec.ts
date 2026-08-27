import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: một nhãn hệ cũ thì ô trên form, cột trên danh sách và bộ lọc phải trỏ CÙNG MỘT CỘT.
 *
 * Ba lớp ấy có thể nhất quán với NHAU mà vẫn sai — và khi đó mọi ca kiểm khứ hồi đều xanh, vì
 * form ghi cột X rồi đọc lại cột X. Chỉ khi đối chiếu với dữ liệu THẬT mới lộ.
 *
 * Đó đúng là chuyện đã xảy ra với "Đơn vị giải quyết", đo trên máy chạy 27/08/2026:
 *
 *   • Đơn thư và Vụ án: ô form ghi `unit`, danh sách đọc `unit`, bộ lọc lọc `unit`.
 *   • Bộ di trú lại đổ vào `donViGiaiQuyet` — 46.642 đơn thư và 3.286 vụ án.
 *   • `unit` có ĐÚNG 0 bản ghi ở cả hai bảng.
 *
 * Hệ quả kép: cột trên danh sách rỗng ở mọi dòng, và bộ lọc theo đơn vị KHÔNG BAO GIỜ ra kết
 * quả — cán bộ lọc theo tổ sẽ tưởng tổ ấy không có hồ sơ nào.
 *
 * Vụ việc trỏ đúng ngay từ đầu, nên nó là bằng chứng rằng cột đúng là `donViGiaiQuyet`.
 *
 * Đọc mã nguồn dạng văn bản: giao diện và máy chủ là hai dự án TypeScript riêng.
 */
const GOC = path.resolve(__dirname, '../..', '..');

interface Man {
  ten: string;
  /** Nơi ô trên form quyết định cột đích. */
  nguonForm: string;
  /** Biểu thức lấy cột đích của ô "Đơn vị giải quyết" từ tệp trên. */
  bieuThucForm: RegExp;
  /** Tệp dựng danh sách. */
  shell: string;
}

const BANG: Man[] = [
  {
    ten: 'Đơn thư',
    nguonForm: 'frontend/src/features/petitions/legacy-form-binding.ts',
    bieuThucForm: /supervisingUnit:\s*'(\w+)'/,
    shell: 'frontend/src/pages/petitions/PetitionListPageShell.tsx',
  },
  {
    ten: 'Vụ việc',
    nguonForm: 'frontend/src/features/incidents/legacy-form-binding.ts',
    bieuThucForm: /supervisingUnit:\s*'(\w+)'/,
    shell: 'frontend/src/pages/incidents/IncidentListPageShell.tsx',
  },
  {
    ten: 'Vụ án',
    nguonForm: 'frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts',
    bieuThucForm: /(\w+):\s*formData\.supervisingUnit/,
    shell: 'frontend/src/pages/cases/CaseListPageShell.tsx',
  },
];

/** Cột mà cột "Đơn vị giải quyết" trên danh sách đang đọc (`r.<cột>`). */
function cotDanhSachDoc(duong: string): string | null {
  const src = fs.readFileSync(duong, 'utf8');
  const i = src.indexOf("header: 'Đơn vị giải quyết'");
  if (i < 0) return null;
  const khoi = src.slice(i, src.indexOf('},', i));
  const m = /\br\.(\w+)/.exec(khoi);
  return m ? m[1] : null;
}

/** Cột mà ô trên form ghi vào. */
function cotFormGhi(man: Man): string | null {
  const src = fs.readFileSync(path.join(GOC, man.nguonForm), 'utf8');
  const m = man.bieuThucForm.exec(src);
  return m ? m[1] : null;
}

describe('GATE "Đơn vị giải quyết" — ô form, cột danh sách và bộ lọc phải trỏ cùng một cột', () => {
  it.each(BANG.map((m) => [m.ten, m] as const))('%s: đọc được cả hai đầu', (_ten, man) => {
    expect(cotFormGhi(man)).not.toBeNull();
    expect(cotDanhSachDoc(path.join(GOC, man.shell))).not.toBeNull();
  });

  it.each(BANG.map((m) => [m.ten, m] as const))(
    '%s: ô form và cột danh sách trỏ cùng một cột',
    (_ten, man) => {
      expect(cotDanhSachDoc(path.join(GOC, man.shell))).toBe(cotFormGhi(man));
    },
  );

  /**
   * Và cột ấy phải là `donViGiaiQuyet` — cột mà bộ di trú đổ dữ liệu vào, và là cột lược đồ
   * ghi rõ nghĩa "Đơn vị giải quyết". `unit` là ĐƠN VỊ TIẾP NHẬN, một khái niệm khác.
   */
  it.each(BANG.map((m) => [m.ten, m] as const))(
    '%s: cột ấy là `donViGiaiQuyet`, không phải `unit`',
    (_ten, man) => {
      expect(cotFormGhi(man)).toBe('donViGiaiQuyet');
    },
  );

  /** Bộ lọc phải lọc trên đúng cột danh sách đang hiện, nếu không nó không bao giờ ra kết quả. */
  it('bộ lọc Đơn thư lọc `donViGiaiQuyet`, không lọc `unit`', () => {
    const src = fs.readFileSync(path.join(GOC, 'backend/src/petitions/petitions.service.ts'), 'utf8');
    const i = src.indexOf('if (query.unit)');
    expect(i).toBeGreaterThan(0);
    const khoi = src.slice(i, src.indexOf('}', i));
    expect(khoi).toContain('where.donViGiaiQuyet');
    expect(khoi).not.toContain('where.unit =');
  });
});
