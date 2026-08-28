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

  it.each(['VU_AN', 'VU_VIEC'] as const)('%s: `dieuLuat` suy từ số điều của tội danh', (e) => {
    expect(resolveField(e, 'dieuLuat', { crimeChinh: { articleNo: 173 } })).toContain('173');
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
