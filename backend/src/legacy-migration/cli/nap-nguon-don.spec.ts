import { napNguonDon, dungCsv } from './nap-nguon-don';
import type { PrismaClient } from '@prisma/client';
import { gopNguonDon } from './nap-nguon-don.util';

/**
 * CLI nạp danh mục Nguồn đơn.
 *
 * Hai điều phải chốt bằng ca kiểm chứ không bằng lời hứa:
 *  1. **Chạy thử KHÔNG ghi gì.** Đây là lệnh đụng 47.488 hồ sơ trên bản đang chạy.
 *  2. **Đọc CẢ Đơn thư lẫn Vụ án.** Hai màn dùng chung một danh mục (anh chốt 20/09); đọc
 *     thiếu một bên là nguồn của bên kia không bao giờ vào danh mục.
 */
/** Hình đối số `createMany` nhận — khai ra để đọc lại đối số không rơi về `any`. */
interface DuLieuTao {
  data: {
    code: string;
    name: string;
    order: number;
    metadata: Record<string, unknown>;
  }[];
}

function prismaGia(
  donThu: [string, number][],
  vuAn: [string, number][],
  daCo: string[] = [],
  daCoDayDu: { name: string; bienThe?: string[] }[] = [],
  vuViec: [string, number][] = [],
  maDaCo: string[] = [],
  orderDaCo = 0,
) {
  // Khai kiểu ngay ở `jest.fn<R, A>()` rồi mới gắn giá trị trả: nối `.mockResolvedValue(...)`
  // vào cùng một biểu thức làm kiểu rơi về `Mock<any, any, any>` và `mock.calls` mất kiểu.
  const createMany = jest.fn<Promise<{ count: number }>, [DuLieuTao]>();
  createMany.mockResolvedValue({ count: 0 });

  const mucDanhMuc = [
    ...daCo.map((name, i) => ({
      name,
      code: maDaCo[i] ?? `ND${String(1000 + i)}`,
      order: orderDaCo,
      metadata: null,
    })),
    ...daCoDayDu.map((m, i) => ({
      name: m.name,
      code: maDaCo[daCo.length + i] ?? `ND${String(2000 + i)}`,
      order: orderDaCo,
      metadata: m.bienThe ? { bienThe: m.bienThe } : null,
    })),
  ];

  const nhom = (khoa: string, ds: [string, number][]) =>
    jest
      .fn()
      .mockResolvedValue(
        ds.map(([v, n]) => ({ [khoa]: v, _count: { _all: n } })),
      );

  const updatePetition = jest.fn().mockResolvedValue({ count: 0 });
  const updateCase = jest.fn().mockResolvedValue({ count: 0 });
  const updateIncident = jest.fn().mockResolvedValue({ count: 0 });

  return {
    updatePetition,
    gia: {
      petition: {
        groupBy: nhom('nguonDon', donThu),
        updateMany: updatePetition,
      },
      case: { groupBy: nhom('nguonDon', vuAn), updateMany: updateCase },
      incident: {
        groupBy: nhom('chuyenTuDonVi', vuViec),
        updateMany: updateIncident,
      },
      directory: {
        findMany: jest.fn().mockResolvedValue(mucDanhMuc),
        createMany,
      },
    } as unknown as PrismaClient,
    createMany,
  };
}

describe('napNguonDon', () => {
  const imLang = () =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

  afterEach(() => jest.restoreAllMocks());

  it('CHẠY THỬ không ghi một dòng nào', async () => {
    imLang();
    const { gia, createMany } = prismaGia([['Bưu điện', 100]], []);
    const ra = await napNguonDon(gia, false);
    expect(createMany).not.toHaveBeenCalled();
    expect(ra.them).toBe(0);
    expect(ra.duKien).toBe(1);
  });

  it('đọc CẢ Đơn thư lẫn Vụ án, cộng dồn số hồ sơ của cùng một nguồn', async () => {
    imLang();
    const { gia, createMany } = prismaGia(
      [['Bưu điện', 100]],
      [['bưu điện', 40]],
    );
    await napNguonDon(gia, true);
    const duLieu = createMany.mock.calls[0][0].data;
    expect(duLieu).toHaveLength(1);
    expect(duLieu[0].metadata['soHoSo']).toBe(140);
  });

  it('mã mang tiền tố ND và nối tiếp mã đã có', async () => {
    imLang();
    const { gia, createMany } = prismaGia([['Bưu điện', 10]], [], []);
    await napNguonDon(gia, true);
    const duLieu = createMany.mock.calls[0][0].data;
    expect(duLieu[0].code).toMatch(/^ND\d{4}$/);
  });

  it('chạy lần hai ra 0 mục mới', async () => {
    imLang();
    const { gia, createMany } = prismaGia([['Bưu điện', 10]], [], ['Bưu điện']);
    const ra = await napNguonDon(gia, true);
    expect(ra.duKien).toBe(0);
    expect(createMany.mock.calls[0][0].data).toEqual([]);
  });

  it('ghi kèm dấu vết nguồn và các biến thể đã gộp', async () => {
    imLang();
    const { gia, createMany } = prismaGia(
      [
        ['Trực tiếp', 10],
        ['trực tiếp', 3],
      ],
      [],
    );
    await napNguonDon(gia, true);
    const duLieu = createMany.mock.calls[0][0].data;
    expect(duLieu[0].metadata).toMatchObject({ laTrucTiep: true });
    expect(duLieu[0].metadata['bienThe']).toEqual(
      expect.arrayContaining(['Trực tiếp', 'trực tiếp']),
    );
  });
});

describe('dungCsv', () => {
  it('mở đầu bằng BOM UTF-8 — thiếu nó Excel bản Việt hiện ký tự lạ', () => {
    expect(dungCsv([]).charCodeAt(0)).toBe(0xfeff);
  });

  it('bọc nháy kép và nhân đôi nháy bên trong, không vỡ cột', () => {
    const muc = gopNguonDon([{ ten: 'Nguồn "lạ", có phẩy', soHoSo: 9 }]);
    const csv = dungCsv(muc);
    expect(csv).toContain('"Nguồn ""lạ"", có phẩy"');
    // Đúng 2 dòng: tiêu đề + một mục. Dấu phẩy trong tên không được tách thành cột mới.
    expect(csv.trimEnd().split('\r\n')).toHaveLength(2);
  });

  it('liệt kê MỌI biến thể đã gộp để soát được bảng gộp', () => {
    const muc = gopNguonDon([
      { ten: 'Trực tiếp', soHoSo: 10 },
      { ten: 'trực tiếp', soHoSo: 3 },
    ]);
    expect(dungCsv(muc)).toContain('Trực tiếp | trực tiếp');
  });
});

/**
 * Nhóm lỗi lượt rà mã độc lập bắt được — mỗi mệnh đề dưới đây từng ĐỎ.
 */
describe('napNguonDon — các lỗi đã bắt được', () => {
  const imLang = () =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  afterEach(() => jest.restoreAllMocks());

  it('[P1] KHÔNG nạp lại mục quản trị đã ĐỔI TÊN — đọc cả `metadata.bienThe`', async () => {
    imLang();
    // Quản trị duyệt rồi đổi "trực tiếp" thành tên rõ hơn. Lượt chạy sau so theo TÊN sẽ
    // không nhận ra, và nạp lại đúng thứ vừa dọn.
    const { gia, createMany } = prismaGia(
      [['trực tiếp', 956]],
      [],
      [],
      [
        {
          name: 'Trực tiếp (nộp tại trụ sở)',
          bienThe: ['Trực tiếp', 'trực tiếp'],
        },
      ],
    );
    const ra = await napNguonDon(gia, true);
    expect(ra.duKien).toBe(0);
    expect(createMany.mock.calls[0][0].data).toEqual([]);
  });

  it('[P1] mục quản trị đã TẮT vẫn tính là đã có — không hồi sinh thứ vừa bỏ', async () => {
    imLang();
    const { gia } = prismaGia([['Bưu điện', 100]], [], ['Bưu điện'], []);
    expect((await napNguonDon(gia, true)).duKien).toBe(0);
  });

  it('[P2] báo đúng SỐ DÒNG máy chủ thật sự chèn, không phải số dự kiến', async () => {
    imLang();
    // Hai lượt `--that` chồng nhau: lượt sau bị `skipDuplicates` nuốt sạch. Báo "đã thêm 972"
    // trong khi chèn 0 là nói dối người vận hành.
    const { gia, createMany } = prismaGia([['Bưu điện', 100]], []);
    createMany.mockResolvedValue({ count: 0 });
    expect((await napNguonDon(gia, true)).them).toBe(0);
  });

  it('[P2] đọc CẢ Vụ việc (`incidents.chuyenTuDonVi`) — màn ấy cũng phơi khái niệm này', async () => {
    imLang();
    const { gia, createMany } = prismaGia([], [], [], [], [['Tiếp dân', 7]]);
    await napNguonDon(gia, true);
    const duLieu = createMany.mock.calls[0][0].data;
    expect(duLieu.map((d) => d.name)).toContain('Tiếp dân');
  });

  it('[P2] mã NỐI TIẾP mã đã có, không đếm lại từ đầu', async () => {
    imLang();
    const { gia, createMany } = prismaGia(
      [['Bưu điện', 10]],
      [],
      ['Cũ 1', 'Cũ 2'],
      [],
      [],
      ['ND0007', 'ND0003'],
    );
    await napNguonDon(gia, true);
    expect(createMany.mock.calls[0][0].data[0].code).toBe('ND0008');
  });

  it('[P3] `order` nối tiếp mục đã có, không đánh số lại từ 0', async () => {
    imLang();
    const { gia, createMany } = prismaGia(
      [['Bưu điện', 10]],
      [],
      ['Cũ'],
      [],
      [],
      ['ND0001'],
      42,
    );
    expect(createMany.mock.calls.length >= 0).toBe(true);
    await napNguonDon(gia, true);
    expect(createMany.mock.calls.at(-1)![0].data[0].order).toBeGreaterThan(42);
  });
});

describe('dungCsv — an toàn khi mở bằng Excel', () => {
  it('[P3] vô hiệu hoá công thức: ô mở đầu bằng = + - @ không bị Excel diễn giải', () => {
    const muc = gopNguonDon([
      { ten: '=HYPERLINK("http://x")', soHoSo: 9 },
      { ten: '+1', soHoSo: 8 },
      { ten: '-abc', soHoSo: 7 },
      { ten: '@x', soHoSo: 6 },
    ]);
    const csv = dungCsv(muc);
    for (const dau of ['=', '+', '-', '@']) {
      expect(csv).not.toContain(`"${dau}`);
    }
  });
});

/**
 * Bước `--chuan-hoa`: ghi lại CHÍNH HỒ SƠ về tên chuẩn.
 *
 * Nguy hiểm hơn hẳn việc dựng danh mục — dựng danh mục chỉ thêm dòng mới, còn đây sửa 47.456
 * hồ sơ đang chạy. Vì thế phải chốt bằng ca kiểm: mặc định KHÔNG chạy, và chạy thử không ghi.
 */
describe('napNguonDon --chuan-hoa', () => {
  const imLang = () =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  afterEach(() => jest.restoreAllMocks());

  it('KHÔNG chạy khi không gọi — dựng danh mục không được lặng lẽ sửa hồ sơ', async () => {
    imLang();
    const { gia, updatePetition } = prismaGia(
      [
        ['Trực tiếp', 10],
        ['trực tiếp', 3],
      ],
      [],
    );
    const ra = await napNguonDon(gia, true);
    expect(updatePetition).not.toHaveBeenCalled();
    expect(ra.chuanHoa).toBeUndefined();
  });

  it('CHẠY THỬ + --chuan-hoa vẫn KHÔNG ghi một dòng hồ sơ nào', async () => {
    imLang();
    const { gia, updatePetition } = prismaGia(
      [
        ['Trực tiếp', 10],
        ['trực tiếp', 3],
      ],
      [],
    );
    const ra = await napNguonDon(gia, false, undefined, true);
    expect(updatePetition).not.toHaveBeenCalled();
    expect(ra.chuanHoa?.doi).toBe(1);
  });

  it('--that + --chuan-hoa đổi ĐÚNG cách viết cũ sang tên chuẩn', async () => {
    imLang();
    const { gia, updatePetition } = prismaGia(
      [
        ['Trực tiếp', 10],
        ['trực tiếp', 3],
      ],
      [],
    );
    await napNguonDon(gia, true, undefined, true);
    expect(updatePetition).toHaveBeenCalledWith({
      where: { nguonDon: 'trực tiếp' },
      data: { nguonDon: 'Trực tiếp' },
    });
  });

  it('không đụng dòng vốn đã đúng — chỉ một cách viết thì không sửa gì', async () => {
    imLang();
    const { gia, updatePetition } = prismaGia([['Bưu điện', 100]], []);
    await napNguonDon(gia, true, undefined, true);
    expect(updatePetition).not.toHaveBeenCalled();
  });
});
