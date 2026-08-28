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

import { REQUIRED_VARS_CHO_KIEM, dongBoNguonBien, dongBoCoBatBuoc } from '../../prisma/seed-document-templates';
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

/**
 * Ba bẫy codex bắt ở vòng ba — đều in ra SAI trên văn bản tố tụng chính thức.
 */
describe('Bẫy vòng ba', () => {
  /**
   * `subjects` gồm cả bị hại và nhân chứng. In tất cả vào `{hoTenBiCan}` là ghi tên người bị
   * hại vào chỗ bị can trên một quyết định khởi tố — sai nghiêm trọng, và không ai đọc bản in
   * mà đoán ra được vì sao.
   */
  it('`hoTenBiCan` chỉ lấy bị can, bỏ bị hại và nhân chứng', () => {
    const hs = {
      subjects: [
        { fullName: 'Người Bị Hại', type: 'VICTIM' },
        { fullName: 'Nguyễn Văn A', type: 'SUSPECT' },
        { fullName: 'Nhân Chứng B', type: 'WITNESS' },
      ],
    };
    const ra = resolveField('VU_AN', 'hoTenBiCan', hs);
    expect(ra).toBe('Nguyễn Văn A');
    expect(ra).not.toContain('Bị Hại');
  });

  it('`namSinh` lấy năm sinh của BỊ CAN, không phải người đầu danh sách', () => {
    const hs = {
      subjects: [
        { fullName: 'Người Bị Hại', type: 'VICTIM', dateOfBirth: new Date('1970-01-01T00:00:00Z') },
        { fullName: 'Nguyễn Văn A', type: 'SUSPECT', dateOfBirth: new Date('1990-05-06T00:00:00Z') },
      ],
    };
    expect(resolveField('VU_AN', 'namSinh', hs)).toBe('1990');
  });

  /** Không ghi loại thì coi là bị can — dữ liệu cũ nhiều bản ghi để trống. */
  it('bản ghi không ghi loại vẫn được coi là bị can', () => {
    expect(resolveField('VU_AN', 'hoTenBiCan', { subjects: [{ fullName: 'Trần Văn C' }] })).toBe(
      'Trần Văn C',
    );
  });

  /**
   * Căn cứ tạm đình chỉ lưu dưới dạng mã (`CHUA_XAC_DINH_BI_CAN`). In thẳng mã ấy vào quyết
   * định là đưa ký hiệu nội bộ của phần mềm vào văn bản gửi đi.
   */
  it('`lyDo` in nhãn tiếng Việt, không in mã', () => {
    const ra = resolveField('VU_AN', 'lyDo', { lyDoTamDinhChiVuAn: ['CHUA_XAC_DINH_BI_CAN'] });
    expect(ra).toContain('Chưa xác định');
    expect(ra).not.toContain('CHUA_XAC_DINH_BI_CAN');
  });

  it('VU_VIEC: `lyDo` cũng in nhãn tiếng Việt', () => {
    const ra = resolveField('VU_VIEC', 'lyDo', { lyDoTamDinhChiVuViec: ['CHUA_CO_KET_QUA_GIAM_DINH'] });
    expect(ra).not.toContain('_');
  });

  /** Mã lạ (dữ liệu cũ) thì in nguyên — thà giữ chữ gốc còn hơn nuốt mất. */
  it('mã không có trong danh mục thì giữ nguyên', () => {
    expect(resolveField('VU_AN', 'lyDo', { lyDoTamDinhChiVuAn: ['Chưa xác định bị can'] })).toBe(
      'Chưa xác định bị can',
    );
  });
});

/**
 * CỔNG: bộ mẫu Đơn thư cũng không được bắt buộc trường không có nguồn dữ liệu.
 *
 * Bốn mẫu đơn thư khoá vì `deXuat` (90/47.169 hồ sơ) và `donViNhan` (0/47.169) — đúng 99,8%
 * hồ sơ không in được. Chặn ở CHÍNH bảng khai, không chỉ ở bước dọn dẹp: cơ sở dữ liệu mới
 * seed lần đầu sẽ đặt lại y như cũ nếu chỉ chữa một đầu.
 */
describe('GATE — mẫu Đơn thư không bắt buộc trường rỗng', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const ma = fs.readFileSync(path.join(__dirname, 'petition-seed.ts'), 'utf8');
  const bang = ma.slice(ma.indexOf('const REQUIRED_BY_DOCTYPE'), ma.indexOf('};', ma.indexOf('const REQUIRED_BY_DOCTYPE')));

  it.each(['deXuat', 'donViNhan'])('bảng khai không còn bắt buộc %s', (t) => {
    expect(bang).not.toContain(`'${t}'`);
  });

  it('khai tường minh danh sách trường không có nguồn', () => {
    expect(ma).toContain('KHONG_CO_NGUON_DON_THU');
  });
});

/**
 * CỔNG: seed phải cập nhật lại NGUỒN của biến theo danh mục hiện tại, không chỉ cờ bắt buộc.
 *
 * Biến lưu trong cơ sở dữ liệu ghi sẵn `source: 'manual'` từ lần seed trước. Khi danh mục
 * được bổ sung khoá tự điền, bản ghi cũ vẫn là `manual` — mà `manual` + `required` thì luật
 * sẵn sàng-in coi LUÔN là thiếu. Kết quả: chữa danh mục xong mà máy thật vẫn khoá 9/28 mẫu.
 *
 * Đo trên máy thật sau khi nạp lần đầu: Đơn thư 14/14 nhưng Vụ việc 2/6, Vụ án 3/8 — đúng
 * những mẫu có biến vừa chuyển sang tự điền.
 */
describe('GATE — seed cập nhật lại nguồn biến theo danh mục', () => {
  it('biến đã lưu là `manual` được chuyển sang tự điền khi danh mục có khoá ấy', () => {
    const ra = dongBoNguonBien('VU_AN', [
      { name: 'hoTenBiCan', label: 'hoTenBiCan', source: 'manual', required: true },
    ]);
    expect(ra[0]).toMatchObject({ source: 'auto', field: 'hoTenBiCan' });
  });

  it('biến KHÔNG có trong danh mục vẫn là cán bộ tự điền', () => {
    const ra = dongBoNguonBien('VU_AN', [
      { name: 'khongCoTrongDanhMuc', label: 'x', source: 'auto', required: false },
    ]);
    expect(ra[0]).toMatchObject({ source: 'manual' });
    expect(ra[0]['field']).toBeUndefined();
  });

  /** `field` là chỗ engine tra dữ liệu — thiếu nó thì ô in ra trống dù nguồn đã đúng. */
  it('giữ `field` admin đã ánh xạ, không ghi đè bằng tên biến', () => {
    const ra = dongBoNguonBien('VU_AN', [
      { name: 'tenVuAnRieng', label: 'x', source: 'auto', field: 'tenVuAn', required: false },
    ]);
    expect(ra[0]['field']).toBe('tenVuAn');
  });

  it('không đụng cờ bắt buộc — việc ấy do nhánh khác lo', () => {
    const ra = dongBoNguonBien('VU_AN', [
      { name: 'hoTenBiCan', label: 'x', source: 'manual', required: true },
    ]);
    expect(ra[0]['required']).toBe(true);
  });
});

/**
 * Đồng bộ cờ bắt buộc theo bảng khai — chạy có chủ đích, không mặc định.
 *
 * Sau khi rút gọn danh sách bắt buộc, cơ sở dữ liệu vẫn giữ cờ cũ do seed lần trước đặt
 * (`lyDo`, `noiXayRa`, `hoTenBiCan`, `ketQua`…). Chúng CÓ nguồn dữ liệu nên không thuộc diện
 * "gỡ vì không có nguồn", mà hồ sơ chưa nhập thì vẫn chặn in — đo trên máy thật: 8/28 mẫu.
 *
 * Không ghi đè mặc định vì admin có quyền tự bật cờ cho mẫu của họ. Bật bằng cờ môi trường
 * `SEED_TEMPLATES_SYNC_REQUIRED=1` khi cần kéo cấu hình về đúng bảng khai.
 */
describe('dongBoCoBatBuoc — kéo cờ bắt buộc về đúng bảng khai', () => {
  it('gỡ cờ mà bảng khai không còn liệt kê', () => {
    const ra = dongBoCoBatBuoc(['tenVuAn'], [
      { name: 'tenVuAn', label: 'x', required: true },
      { name: 'noiXayRa', label: 'x', required: true },
    ]);
    expect(ra.find((v) => v['name'] === 'noiXayRa')?.['required']).toBe(false);
  });

  it('giữ cờ mà bảng khai vẫn liệt kê', () => {
    const ra = dongBoCoBatBuoc(['tenVuAn'], [{ name: 'tenVuAn', label: 'x', required: true }]);
    expect(ra[0]['required']).toBe(true);
  });

  it('bật cờ cho biến bảng khai liệt kê mà cơ sở dữ liệu chưa bật', () => {
    const ra = dongBoCoBatBuoc(['tenVuAn'], [{ name: 'tenVuAn', label: 'x', required: false }]);
    expect(ra[0]['required']).toBe(true);
  });

  it('không đụng những khoá khác của biến', () => {
    const ra = dongBoCoBatBuoc([], [
      { name: 'x', label: 'nhãn', source: 'auto', field: 'x', required: true },
    ]);
    expect(ra[0]).toMatchObject({ label: 'nhãn', source: 'auto', field: 'x', required: false });
  });
});
