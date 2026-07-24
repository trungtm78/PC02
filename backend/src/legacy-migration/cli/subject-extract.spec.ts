import { bocDoiTuong, bocTenDanhSach, normalizeTen } from './subject-extract';

describe('bocTenDanhSach — trường nghi vấn đối tượng (vai trò đã biết)', () => {
  it('tách danh sách tên ngăn bởi dấu phẩy', () => {
    const ds = bocTenDanhSach('Nguyễn Minh Trung, Lê Tiến Thành, Phạm Quốc Đình Chương', 'SUSPECT');
    expect(ds.map((x) => x.hoTen)).toEqual([
      'Nguyễn Minh Trung',
      'Lê Tiến Thành',
      'Phạm Quốc Đình Chương',
    ]);
    expect(ds.every((x) => x.vaiTro === 'SUSPECT')).toBe(true);
  });

  it('bắt quốc tịch trong ngoặc, bỏ ngoặc khỏi tên', () => {
    const ds = bocTenDanhSach('BRIGOLA ROWENA BOLALIN (Philipin)', 'SUSPECT');
    expect(ds[0].hoTen).toBe('BRIGOLA ROWENA BOLALIN');
    expect(ds[0].quocTich).toBe('Philipin');
  });

  it('bỏ cụm dẫn "nghi vấn là"', () => {
    const ds = bocTenDanhSach('nghi vấn là Nguyễn Thanh Tùng', 'SUSPECT');
    expect(ds[0].hoTen).toBe('Nguyễn Thanh Tùng');
  });

  it('ngoặc không phải quốc gia (tên gọi khác) → bỏ ngoặc, không gán quốc tịch', () => {
    const ds = bocTenDanhSach('Nguyễn Thị Luôn (Nguyễn Ngọc Thuận)', 'SUSPECT');
    expect(ds[0].hoTen).toBe('Nguyễn Thị Luôn');
    expect(ds[0].quocTich).toBeUndefined();
  });

  it('khử trùng tên trong cùng trường', () => {
    const ds = bocTenDanhSach('Trần Văn A, Trần Văn A', 'SUSPECT');
    expect(ds).toHaveLength(1);
  });

  it('bỏ token không phải tên (1 từ / rỗng)', () => {
    const ds = bocTenDanhSach('Hùng, , 123, Nguyễn Văn B', 'SUSPECT');
    expect(ds.map((x) => x.hoTen)).toEqual(['Nguyễn Văn B']);
  });

  it('vai trò VICTIM truyền qua', () => {
    const ds = bocTenDanhSach('Lý Ngân Giang, Trần Thị Mãnh', 'VICTIM');
    expect(ds.every((x) => x.vaiTro === 'VICTIM')).toBe(true);
  });

  it('chuỗi rỗng → mảng rỗng', () => {
    expect(bocTenDanhSach('', 'SUSPECT')).toEqual([]);
  });
});

describe('normalizeTen', () => {
  it('bỏ dấu + chữ thường để khử trùng', () => {
    expect(normalizeTen('Nguyễn Đình Trung')).toBe('nguyen dinh trung');
    expect(normalizeTen('nguyen  dinh   trung')).toBe('nguyen dinh trung');
  });
});

/** Dữ liệu test là tóm tắt THẬT trong dump prod local. */

describe('bocDoiTuong — mẫu "Tên (SN: yyyy)"', () => {
  it('vụ Lê Đặng Thành Vũ + Đỗ Văn Bảo + bị hại Lý Ngân Giang', () => {
    const t =
      'Đối tượng: Lê Đặng Thành Vũ (SN: 1998; HKTT: Ấp Trường Lộc, xã Trường Khánh, thành phố Cần Thơ); ' +
      'Đỗ Văn Bảo (SN: 2005; HKTT: KP Đông Hưng, xã Tân Hiệp, tỉnh An Giang); ' +
      'bị hại: Lý Ngân Giang (SN: 2008; HKTT: ấp An Cư, Đặc khu Kiên Hải, tỉnh An Giang)';
    const dt = bocDoiTuong(t);
    const ten = dt.map((x) => x.hoTen);
    expect(ten).toContain('Lê Đặng Thành Vũ');
    expect(ten).toContain('Đỗ Văn Bảo');
    expect(ten).toContain('Lý Ngân Giang');
    expect(dt.find((x) => x.hoTen === 'Lê Đặng Thành Vũ')!.namSinh).toBe(1998);
    expect(dt.find((x) => x.hoTen === 'Lý Ngân Giang')!.vaiTro).toBe('VICTIM');
  });

  it('bắt được địa chỉ HKTT', () => {
    const dt = bocDoiTuong('Nguyễn Văn A (SN: 1990; HKTT: 12 Lê Lợi, phường 1, quận 3)');
    expect(dt[0].diaChi).toContain('Lê Lợi');
  });

  it('mẫu "Tên, SN: yyyy, ngụ:" — Nguyễn Huy Khánh', () => {
    const dt = bocDoiTuong('Nguyễn Huy Khánh, SN: 1995, ngụ: 88/38 Nguyễn Khoái, phường 2, quận 4, TP. HCM tổ chức sinh nhật');
    expect(dt[0].hoTen).toBe('Nguyễn Huy Khánh');
    expect(dt[0].namSinh).toBe(1995);
    expect(dt[0].diaChi).toContain('Nguyễn Khoái');
  });

  it('tên viết hoa toàn bộ + quốc tịch — ELENA DE ANGELIS', () => {
    const dt = bocDoiTuong('bà ELENA DE ANGELIS, SN: 1968, tạm trú: P.024 khách sạn My House Saigon');
    expect(dt[0].hoTen).toBe('ELENA DE ANGELIS');
    expect(dt[0].namSinh).toBe(1968);
  });

  it('bắt CCCD 12 số làm khoá định danh', () => {
    const dt = bocDoiTuong('Trần Văn B (SN: 1988, CCCD: 079088001234, HKTT: quận 5)');
    expect(dt[0].cccd).toBe('079088001234');
    expect(dt[0].khoaDinhDanh).toBe('cccd:079088001234');
  });

  it('bắt CMND 9 số', () => {
    const dt = bocDoiTuong('Phạm Văn C (SN: 1975, CMND 023456789)');
    expect(dt[0].cmnd).toBe('023456789');
  });

  it('bắt hộ chiếu', () => {
    const dt = bocDoiTuong('John Michael Smith (SN: 1980, hộ chiếu C1234567)');
    expect(dt[0].hoChieu).toBe('C1234567');
    expect(dt[0].khoaDinhDanh).toContain('hc:');
  });
});

describe('bocDoiTuong — khử trùng theo tiêu chí duy nhất', () => {
  it('cùng CCCD trong một hồ sơ → chỉ một đối tượng', () => {
    const dt = bocDoiTuong(
      'Nguyễn Văn A (SN: 1990, CCCD: 079090001111). Sau đó Nguyễn Văn A (SN: 1990, CCCD: 079090001111) bỏ trốn.',
    );
    expect(dt).toHaveLength(1);
  });

  it('hai người khác nhau → hai đối tượng', () => {
    const dt = bocDoiTuong('Nguyễn Văn A (SN: 1990). Trần Thị B (SN: 1992).');
    expect(dt).toHaveLength(2);
  });
});

describe('bocDoiTuong — không đoán bừa (ô trống hơn ô sai)', () => {
  it('không có mẫu tên+SN → không bóc gì', () => {
    expect(bocDoiTuong('Vụ trộm cắp tài sản xảy ra tại quận 1, chưa rõ đối tượng.')).toEqual([]);
  });

  it('năm sinh vô lý → bỏ', () => {
    expect(bocDoiTuong('Nguyễn Văn A (SN: 1850)')).toEqual([]);
  });

  it('một từ không đủ làm tên', () => {
    expect(bocDoiTuong('Hùng SN: 1990')).toEqual([]);
  });

  it('đoạn rỗng/quá ngắn → mảng rỗng', () => {
    expect(bocDoiTuong('')).toEqual([]);
    expect(bocDoiTuong('abc')).toEqual([]);
  });
});
