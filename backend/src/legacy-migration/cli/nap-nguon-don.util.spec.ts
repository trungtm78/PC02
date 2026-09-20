import {
  bangDoiTenChuan,
  gopNguonDon,
  NGUONG_CHO_DUYET,
  type GiaTriHeCu,
} from './nap-nguon-don.util';

/**
 * Gộp 1.431 cách viết "Nguồn đơn/Đơn vị giao" của hệ cũ thành danh mục.
 *
 * Hàm THUẦN, không đụng cơ sở dữ liệu — phần khó (gộp thế nào, chọn tên nào làm tên chuẩn,
 * mục nào phải chờ duyệt) kiểm được mà không cần máy chủ.
 *
 * Số liệu prod 20/09/2026: 47.456 đơn có giá trị · 1.431 cách viết · gộp còn 972 nhóm ·
 * 713 nhóm dưới 3 hồ sơ. Nhiều nhất: Bưu điện 14.758 · Trực tiếp 10.656 · "trực tiếp" 956.
 */
const g = (ten: string, soHoSo: number): GiaTriHeCu => ({ ten, soHoSo });

describe('gopNguonDon', () => {
  it('gộp các cách viết cùng nghĩa về MỘT mục', () => {
    const ra = gopNguonDon([
      g('Trực tiếp', 10656),
      g('trực tiếp', 956),
      g('TRỰC TIẾP', 12),
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].soHoSo).toBe(10656 + 956 + 12);
  });

  it('lấy cách viết PHỔ BIẾN NHẤT làm tên chuẩn', () => {
    const ra = gopNguonDon([g('trực tiếp', 956), g('Trực tiếp', 10656)]);
    expect(ra[0].name).toBe('Trực tiếp');
  });

  it('giữ lại MỌI biến thể đã gộp để anh soát trước khi ghi', () => {
    const ra = gopNguonDon([g('Trực tiếp', 10656), g('trực tiếp', 956)]);
    expect(ra[0].bienThe.sort()).toEqual(['Trực tiếp', 'trực tiếp']);
  });

  it('gộp cả chữ gõ tổ hợp (NFD) — 2.162 dòng prod ở dạng ấy', () => {
    const ra = gopNguonDon([
      g('Trực tiếp'.normalize('NFC'), 10),
      g('Trực tiếp'.normalize('NFD'), 5),
    ]);
    expect(ra).toHaveLength(1);
  });

  it('mục "Trực tiếp" mang cờ laTrucTiep, mục khác thì không', () => {
    const ra = gopNguonDon([g('Trực tiếp', 10), g('Bưu điện', 20)]);
    expect(ra.find((m) => m.name === 'Trực tiếp')!.laTrucTiep).toBe(true);
    expect(ra.find((m) => m.name === 'Bưu điện')!.laTrucTiep).toBe(false);
  });

  it(`mục dưới ${NGUONG_CHO_DUYET} hồ sơ vào trạng thái CHỜ DUYỆT, không bỏ đi`, () => {
    // 713/972 nhóm prod dưới ngưỡng. Bỏ chúng là mất chỗ nhập cho hồ sơ cũ; nhận thẳng là
    // đổ rác vào ô chọn của cán bộ. Nạp nhưng đánh dấu.
    const ra = gopNguonDon([
      g('Nguồn lạ chỉ 1 hồ sơ', 1),
      g('Bưu điện', 14758),
    ]);
    expect(ra.find((m) => m.name === 'Nguồn lạ chỉ 1 hồ sơ')!.choDuyet).toBe(
      true,
    );
    expect(ra.find((m) => m.name === 'Bưu điện')!.choDuyet).toBe(false);
  });

  it('xếp mục nhiều hồ sơ lên trước — cán bộ gặp thứ hay dùng ngay đầu', () => {
    const ra = gopNguonDon([
      g('Hiếm', 2),
      g('Bưu điện', 14758),
      g('Trực tiếp', 10656),
    ]);
    expect(ra.map((m) => m.name)).toEqual(['Bưu điện', 'Trực tiếp', 'Hiếm']);
    expect(ra[0].order).toBeLessThan(ra[1].order);
  });

  it('BỎ QUA mục danh mục đã có — chạy lại lần hai ra 0 mục mới', () => {
    const dl = [g('Bưu điện', 14758), g('Trực tiếp', 10656)];
    expect(gopNguonDon(dl, ['Bưu điện', 'Trực tiếp'])).toEqual([]);
  });

  it('so mục đã có theo KHOÁ GỘP, không theo chuỗi thô', () => {
    expect(gopNguonDon([g('trực tiếp', 956)], ['Trực tiếp'])).toEqual([]);
  });

  it('bỏ giá trị rỗng và chỉ-khoảng-trắng, không dựng mục rỗng', () => {
    expect(
      gopNguonDon([g('', 5), g('   ', 3), g('Bưu điện', 10)]),
    ).toHaveLength(1);
  });

  it('danh sách rỗng ra mảng rỗng', () => {
    expect(gopNguonDon([])).toEqual([]);
  });
});

/**
 * Dựng danh mục thôi chưa giải quyết động cơ ban đầu — 47.456 hồ sơ vẫn giữ 1.431 cách viết,
 * nên báo cáo theo nguồn vẫn sai. Cần bảng đổi để ghi lại chính hồ sơ.
 */
describe('bangDoiTenChuan', () => {
  it('chỉ trả cặp THẬT SỰ đổi — không đụng dòng vốn đã đúng', () => {
    const muc = gopNguonDon([g('Trực tiếp', 10656), g('trực tiếp', 956)]);
    expect(bangDoiTenChuan(muc)).toEqual([
      { cu: 'trực tiếp', chuan: 'Trực tiếp' },
    ]);
  });

  it('mục chỉ có một cách viết thì không sinh cặp nào', () => {
    expect(bangDoiTenChuan(gopNguonDon([g('Bưu điện', 100)]))).toEqual([]);
  });

  it('gom mọi biến thể của cùng một mục', () => {
    const muc = gopNguonDon([
      g('Trực tiếp', 100),
      g('trực tiếp', 50),
      g('TRỰC TIẾP', 10),
    ]);
    expect(
      bangDoiTenChuan(muc)
        .map((c) => c.cu)
        .sort(),
    ).toEqual(['TRỰC TIẾP', 'trực tiếp']);
    expect(bangDoiTenChuan(muc).every((c) => c.chuan === 'Trực tiếp')).toBe(
      true,
    );
  });
});
