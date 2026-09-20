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
) {
  // Khai kiểu ngay ở `jest.fn<R, A>()` rồi mới gắn giá trị trả: nối `.mockResolvedValue(...)`
  // vào cùng một biểu thức làm kiểu rơi về `Mock<any, any, any>`, và `mock.calls` mất kiểu —
  // đọc lại đối số sẽ là `any`. Cùng lối với `directory/tao-nhanh-loai-thong-tin.spec.ts`.
  const createMany = jest.fn<Promise<{ count: number }>, [DuLieuTao]>();
  createMany.mockResolvedValue({ count: 0 });
  return {
    gia: {
      petition: {
        groupBy: jest
          .fn()
          .mockResolvedValue(
            donThu.map(([nguonDon, n]) => ({ nguonDon, _count: { _all: n } })),
          ),
      },
      case: {
        groupBy: jest
          .fn()
          .mockResolvedValue(
            vuAn.map(([nguonDon, n]) => ({ nguonDon, _count: { _all: n } })),
          ),
      },
      directory: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            daCo.map((name, i) => ({ name, code: `ND${1000 + i}` })),
          ),
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
