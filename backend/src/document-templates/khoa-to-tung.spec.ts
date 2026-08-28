import { resolveField, catalogKeys } from './field-catalog';

/**
 * 13 mẫu quyết định tố tụng của hệ mới khai nhiều biến là "cán bộ tự điền" (`manual`) dù hệ
 * thống ĐÃ CÓ sẵn dữ liệu. Theo luật sẵn sàng-in thì `manual` bắt buộc LUÔN bị coi là thiếu,
 * nên mẫu không bao giờ in được — đo trên máy thật 28/08/2026: Vụ việc 0/5, Vụ án 0/5.
 *
 * Bộ ca kiểm này chốt: mỗi biến ấy phải tra được từ dữ liệu hồ sơ.
 */
describe('Khoá tự điền cho mẫu quyết định tố tụng', () => {
  it('VU_AN: `toiDanh` đọc được cả khi tội danh nằm ở quan hệ `crimeChinh`', () => {
    // Cột `crime` là chữ tự do có từ trước; hồ sơ di trú gắn tội danh qua quan hệ. Chỉ đọc
    // `crime` thì 2.953 vụ án có `crimeChinh` mà cột kia rỗng sẽ in ra trống.
    expect(resolveField('VU_AN', 'toiDanh', { crimeChinh: { name: 'Tội giết người' } })).toBe(
      'Tội giết người',
    );
    expect(resolveField('VU_AN', 'toiDanh', { crime: 'Trộm cắp tài sản' })).toBe(
      'Trộm cắp tài sản',
    );
  });

  it('VU_VIEC: `toiDanh` đọc từ quan hệ tội danh của vụ việc', () => {
    expect(resolveField('VU_VIEC', 'toiDanh', { crimeChinh: { name: 'Lừa đảo' } })).toBe('Lừa đảo');
  });

  /**
   * Mẫu đã viết sẵn chữ "Bộ luật Hình sự" ngay sau chỗ trống (`{dieuLuat} Bộ luật Hình sự`),
   * nên khoá này chỉ trả cụm "Điều 173". Trả kèm hậu tố là văn bản in ra
   * "Điều 173 Bộ luật Hình sự Bộ luật Hình sự".
   */
  it.each(['VU_AN', 'VU_VIEC'] as const)('%s: `dieuLuat` chỉ trả cụm điều, không kèm hậu tố', (e) => {
    const ra = resolveField(e, 'dieuLuat', { crimeChinh: { articleNo: 173 } });
    expect(ra).toBe('Điều 173');
    expect(ra).not.toContain('Bộ luật');
  });

  it('VU_AN: `hoTenBiCan` lấy bị can đầu tiên của vụ án', () => {
    expect(
      resolveField('VU_AN', 'hoTenBiCan', { subjects: [{ fullName: 'Nguyễn Văn A' }] }),
    ).toBe('Nguyễn Văn A');
  });

  it('VU_AN: nhiều bị can thì liệt kê, không chỉ in một người', () => {
    const ra = resolveField('VU_AN', 'hoTenBiCan', {
      subjects: [{ fullName: 'Nguyễn Văn A' }, { fullName: 'Trần Thị B' }],
    });
    expect(ra).toContain('Nguyễn Văn A');
    expect(ra).toContain('Trần Thị B');
  });

  it('VU_AN: `namSinh` lấy năm sinh bị can đầu tiên', () => {
    expect(
      resolveField('VU_AN', 'namSinh', {
        subjects: [{ fullName: 'A', dateOfBirth: new Date('1985-03-02T00:00:00Z') }],
      }),
    ).toBe('1985');
  });

  it('VU_AN: `lyDo` đọc căn cứ tạm đình chỉ', () => {
    expect(resolveField('VU_AN', 'lyDo', { lyDoTamDinhChiVuAn: ['Chưa xác định bị can'] })).toBe(
      'Chưa xác định bị can',
    );
  });

  it('VU_VIEC: `lyDo` đọc căn cứ tạm đình chỉ vụ việc', () => {
    expect(
      resolveField('VU_VIEC', 'lyDo', { lyDoTamDinhChiVuViec: ['Chờ kết quả giám định'] }),
    ).toBe('Chờ kết quả giám định');
  });

  it('VU_VIEC: `ketQua` đọc kết quả giải quyết nguồn tin', () => {
    expect(resolveField('VU_VIEC', 'ketQua', { ketQuaXuLy: 'Đã ra QĐ khởi tố' })).toBe(
      'Đã ra QĐ khởi tố',
    );
  });

  it('VU_AN: `noiXayRa` đọc nơi xảy ra', () => {
    expect(resolveField('VU_AN', 'noiXayRa', { noiXayRa: 'tỉnh Hưng Yên' })).toBe('tỉnh Hưng Yên');
  });

  it.each(['VU_AN', 'VU_VIEC'] as const)('%s: `nguoiNhan` lấy cán bộ nhập', (e) => {
    expect(
      resolveField(e, 'nguoiNhan', { canBoNhap: { lastName: 'Trần Hoàng', firstName: 'Duy' } }),
    ).toBe('Trần Hoàng Duy');
  });

  /** Thiếu dữ liệu thì trả rỗng — in ra chỗ trống, KHÔNG chặn in. */
  it.each(['toiDanh', 'dieuLuat', 'hoTenBiCan', 'namSinh', 'lyDo', 'noiXayRa'])(
    '%s: hồ sơ trống thì trả rỗng, không ném',
    (khoa) => {
      expect(resolveField('VU_AN', khoa, {})).toBe('');
    },
  );

  it('mọi khoá mới đều nằm trong danh mục cho phép', () => {
    const vuAn = new Set(catalogKeys('VU_AN'));
    const vuViec = new Set(catalogKeys('VU_VIEC'));
    for (const k of ['toiDanh', 'dieuLuat', 'hoTenBiCan', 'namSinh', 'lyDo', 'noiXayRa', 'nguoiNhan'])
      expect(vuAn.has(k)).toBe(true);
    for (const k of ['toiDanh', 'dieuLuat', 'lyDo', 'ketQua', 'nguoiNhan'])
      expect(vuViec.has(k)).toBe(true);
  });
});

import { REQUIRED_VARS_CHO_KIEM } from '../../prisma/seed-document-templates';
import { TEMPLATE_SPECS } from '../../prisma/seed-assets/document-templates/registry';

/**
 * CỔNG: không mẫu nào được đánh dấu bắt buộc một trường mà hệ thống KHÔNG có nguồn dữ liệu.
 *
 * Luật sẵn sàng-in coi biến bắt buộc còn rỗng là "chưa in được", nên mỗi trường như vậy khoá
 * vĩnh viễn một mẫu. Đúng chuyện đã xảy ra: `soKLDT` 0/3.673 vụ án, `nguonTin` và
 * `nguoiQuyetDinh` 0/4.848 vụ việc — cả ba đều 0 trong bản gốc hệ cũ.
 */
describe('GATE — biến bắt buộc phải có nguồn dữ liệu thật', () => {
  const KHONG_CO_NGUON = ['soKLDT', 'nguonTin', 'nguoiQuyetDinh', 'gioBatDau', 'diaDiem'];

  it.each(Object.entries(REQUIRED_VARS_CHO_KIEM))('%s không bắt buộc trường rỗng', (_ma, ds) => {
    expect((ds as string[]).filter((x) => KHONG_CO_NGUON.includes(x))).toEqual([]);
  });

  /** Thực thể lấy từ chính bảng khai mẫu, không đoán từ tên mã — đoán là sai ngay mẫu đầu. */
  it('mọi biến bắt buộc đều tra được trong danh mục của ĐÚNG thực thể', () => {
    for (const [ma, ds] of Object.entries(REQUIRED_VARS_CHO_KIEM)) {
      const spec = TEMPLATE_SPECS.find((t) => t.code === ma);
      expect({ ma, coSpec: !!spec }).toEqual({ ma, coSpec: true });
      const khoa = new Set(catalogKeys(spec!.entityType as never));
      for (const b of ds as string[]) expect({ ma, b, co: khoa.has(b) }).toEqual({ ma, b, co: true });
    }
  });
});

/**
 * CỔNG: đường nạp hồ sơ để in phải kèm quan hệ mà khoá tự điền cần.
 *
 * Khoá `toiDanh`/`dieuLuat` đọc `crimeChinh`. Đường nạp không `include` quan hệ ấy thì khoá
 * trả rỗng — mẫu vẫn "in được" nhưng ô tội danh và điều luật TRỐNG, và cán bộ nhìn bản in
 * tưởng hồ sơ chưa nhập tội danh. Hỏng im lặng, tệ hơn báo thiếu.
 */
describe('GATE — đường nạp hồ sơ kèm quan hệ tội danh', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  const thanGetById = (duong: string): string => {
    const src = fs.readFileSync(path.join(__dirname, duong), "utf8");
    const i = src.indexOf("async getById(");
    expect(i).toBeGreaterThan(0);
    return src.slice(i, src.indexOf("\n  async ", i + 10));
  };

  it.each([
    ["Vụ việc", "../incidents/incidents.service.ts"],
    ["Vụ án", "../cases/cases.service.ts"],
  ])("%s: `getById` include `crimeChinh`", (_ten, duong) => {
    const than = thanGetById(duong);
    expect(than).toContain("crimeChinh");
    expect(than).toContain("articleNo");
  });

  /**
   * `hoTenBiCan`/`namSinh` đọc `record.subjects`. Đường nạp không kèm bị can thì ba mẫu
   * "QĐ khởi tố bị can", "Kết luận điều tra", "Biên bản hỏi cung" in ra ô trống dù vụ án đã
   * có bị can — hỏng im lặng, tệ hơn báo thiếu.
   */
  it("Vụ án: `getById` include `subjects` kèm họ tên và ngày sinh", () => {
    const than = thanGetById("../cases/cases.service.ts");
    expect(than).toMatch(/subjects:\s*\{/);
    expect(than).toContain("fullName");
    expect(than).toContain("dateOfBirth");
  });
});

/**
 * CỔNG: seed phải GỠ được cờ bắt buộc đã nằm sẵn trong cơ sở dữ liệu.
 *
 * Bản trước bỏ qua toàn bộ khi mẫu "đã có cấu hình required" — mà mọi môi trường đã chạy seed
 * đều rơi vào đó. Nghĩa là danh sách bắt buộc thu hẹp KHÔNG BAO GIỜ tới được máy thật, và mẫu
 * vẫn bị khoá y như cũ. Bản vá suýt thành vô nghĩa.
 */
describe('GATE — seed gỡ được cờ bắt buộc cũ trên máy đã chạy', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const ma = fs.readFileSync(
    path.join(__dirname, '..', '..', 'prisma', 'seed-document-templates.ts'),
    'utf8',
  );

  it('không bỏ qua mẫu chỉ vì "đã có cấu hình"', () => {
    // Đường cũ: `if (!alreadyConfigured) { … } else { giữ nguyên }` — không còn được phép.
    expect(ma).not.toMatch(/if\s*\(!alreadyConfigured\)/);
  });

  it('khai tường minh danh sách trường không có nguồn dữ liệu', () => {
    expect(ma).toContain('KHONG_CO_NGUON');
    for (const t of ['soKLDT', 'nguonTin', 'nguoiQuyetDinh']) expect(ma).toContain(t);
  });

  it('có nhánh cập nhật khi phát hiện cờ bắt buộc cần gỡ', () => {
    expect(ma).toMatch(/daGoBo/);
    expect(ma).toMatch(/documentTemplate\.update/);
  });
});
