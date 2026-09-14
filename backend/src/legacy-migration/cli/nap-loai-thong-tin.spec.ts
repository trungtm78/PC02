import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LoaiDon, type PrismaClient } from '@prisma/client';
import { napLoaiThongTin } from './nap-loai-thong-tin';

/**
 * Đường ghi của CLI nạp Loại thông tin — prisma giả ở RANH GIỚI cơ sở dữ liệu, còn luật gộp là
 * hàm thật. Ca kiểm canh ba điều mà hàm thuần không chứng minh được: bộ đọc lấy đủ cột kế hoạch
 * cần, chạy thử không ghi gì, và câu ghi mang điều kiện chặn đè giá trị cán bộ vừa sửa.
 */
interface CauSql {
  sql: string;
  thamSo: unknown[];
}

function gia(opts: {
  hoSo: Array<{
    id: string;
    stt: string;
    loaiThongTin: string | null;
    petitionType: LoaiDon | null;
    tomTat: string | null;
  }>;
  vuViec?: Array<{ giaTri: string; soHoSo: number }>;
  vuAn?: Array<{ giaTri: string; soHoSo: number }>;
  daCo?: Array<{ name: string; code: string; metadata: unknown }>;
}) {
  const doc: CauSql[] = [];
  const ghi: CauSql[] = [];
  const createMany = jest.fn(
    ({ data }: { data: unknown[]; skipDuplicates?: boolean }) =>
      Promise.resolve({ count: data.length }),
  );
  const findMany = jest.fn().mockResolvedValue(opts.daCo ?? []);
  const prisma = {
    $queryRaw: jest.fn((chuoi: TemplateStringsArray, ...thamSo: unknown[]) => {
      const sql = chuoi.join('?');
      doc.push({ sql, thamSo });
      if (sql.includes('FROM incidents'))
        return Promise.resolve(opts.vuViec ?? []);
      if (sql.includes('FROM cases')) return Promise.resolve(opts.vuAn ?? []);
      return Promise.resolve(opts.hoSo);
    }),
    $executeRaw: jest.fn(
      (chuoi: TemplateStringsArray, ...thamSo: unknown[]) => {
        ghi.push({ sql: chuoi.join('?'), thamSo });
        return Promise.resolve((thamSo[0] as unknown[]).length);
      },
    ),
    directory: { findMany, createMany },
  } as unknown as PrismaClient;
  return { prisma, doc, ghi, createMany, findMany };
}

const HO_SO = [
  {
    id: 'a',
    stt: '2025-1',
    loaiThongTin: 'tố giác ',
    petitionType: null,
    tomTat: 'Tố giác ông A',
  },
  {
    id: 'b',
    stt: '2025-2',
    loaiThongTin: 'Tố giác',
    petitionType: null,
    tomTat: 'x',
  },
  {
    id: 'c',
    stt: '2025-3',
    loaiThongTin: 'Tố giác',
    petitionType: LoaiDon.TO_CAO,
    tomTat: 'x',
  },
  {
    id: 'd',
    stt: '2025-4',
    loaiThongTin: null,
    petitionType: null,
    tomTat: 'Tố giác bà B',
  },
  {
    id: 'e',
    stt: '2025-5',
    loaiThongTin: 'Khiếu nại (QĐ tố tụng)',
    petitionType: null,
    tomTat: 'x',
  },
  {
    id: 'f',
    stt: '2025-6',
    loaiThongTin: '',
    petitionType: null,
    tomTat: 'Văn phòng luật sư',
  },
];

describe('napLoaiThongTin', () => {
  let thuMuc: string;
  let csv: string;

  beforeEach(() => {
    thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'nap-ltt-'));
    csv = path.join(thuMuc, 'bang-gop.csv');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    fs.rmSync(thuMuc, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('bộ đọc hồ sơ lấy đủ cột mà kế hoạch đọc, chỉ hồ sơ chưa xoá', async () => {
    const { prisma, doc } = gia({ hoSo: HO_SO });
    await napLoaiThongTin(prisma, false, csv);
    const docHoSo = doc.find((c) => c.sql.includes('FROM petitions'));
    expect(docHoSo).toBeDefined();
    for (const cot of [
      'id',
      'stt',
      '"loaiThongTin"',
      '"petitionType"',
      '"tomTat"',
      '"deletedAt" IS NULL',
    ]) {
      expect(docHoSo!.sql).toContain(cot);
    }
    expect(doc.find((c) => c.sql.includes('FROM incidents'))?.sql).toContain(
      '"deletedAt" IS NULL',
    );
    expect(doc.find((c) => c.sql.includes('FROM cases'))?.sql).toContain(
      'loai_thong_tin',
    );
  });

  it('chạy thử: in bảng gộp ra CSV, KHÔNG ghi gì', async () => {
    const { prisma, ghi, createMany } = gia({ hoSo: HO_SO });
    const kq = await napLoaiThongTin(prisma, false, csv);

    expect(createMany).not.toHaveBeenCalled();
    expect(ghi).toEqual([]);
    expect(kq).toEqual({
      mucMoi: 2,
      doiTen: 1,
      dienTrong: 1,
      ganNhom: 4,
      khongSuyDuoc: 1,
      daGhi: { muc: 0, loai: 0, nhom: 0 },
    });
    const noiDung = fs.readFileSync(csv, 'utf-8');
    expect(noiDung).toContain(
      'Tố giác,3,PHAN_ANH,Không,Không,Tố giác | tố giác',
    );
    expect(noiDung).toContain('Khiếu nại (QĐ tố tụng),1,KHIEU_NAI,Có,Không');
  });

  it('ghi thật: tạo mục mới nối tiếp mã đang có, mang metadata nguồn/nhóm hạn/chờ duyệt', async () => {
    const { prisma, createMany } = gia({
      hoSo: HO_SO,
      daCo: [
        {
          name: 'Kêu cứu',
          code: 'LTT0007',
          metadata: { nhomHan: LoaiDon.PHAN_ANH },
        },
      ],
    });
    await napLoaiThongTin(prisma, true, csv);

    expect(createMany).toHaveBeenCalledTimes(1);
    const { data, skipDuplicates } = createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data).toEqual([
      {
        type: 'LOAI_THONG_TIN',
        code: 'LTT0008',
        name: 'Tố giác',
        order: 0,
        isActive: true,
        metadata: {
          nhomHan: LoaiDon.PHAN_ANH,
          nguon: 'legacy',
          choDuyet: false,
          soHoSo: 3,
          bienThe: ['Tố giác', 'tố giác'],
        },
      },
      {
        type: 'LOAI_THONG_TIN',
        code: 'LTT0009',
        name: 'Khiếu nại (QĐ tố tụng)',
        order: 9001,
        isActive: true,
        metadata: {
          nhomHan: LoaiDon.KHIEU_NAI,
          nguon: 'legacy',
          choDuyet: true,
          soHoSo: 1,
          bienThe: ['Khiếu nại (QĐ tố tụng)'],
        },
      },
    ]);
  });

  it('ghi thật: đổi loại TRƯỚC rồi mới gán nhóm, cả hai có điều kiện chặn đè', async () => {
    const { prisma, ghi } = gia({ hoSo: HO_SO });
    const kq = await napLoaiThongTin(prisma, true, csv);

    expect(ghi).toHaveLength(2);
    const [doiLoai, ganNhom] = ghi;
    expect(doiLoai.sql).toContain('SET "loaiThongTin" = v.moi');
    expect(doiLoai.sql).toContain('"loaiThongTin" IS NOT DISTINCT FROM v.cu');
    expect(doiLoai.thamSo).toEqual([
      ['a', 'd'],
      ['tố giác ', null],
      ['Tố giác', 'Tố giác'],
    ]);

    expect(ganNhom.sql).toContain('SET "petitionType" = v.nhom::"LoaiDon"');
    expect(ganNhom.sql).toContain('"petitionType" IS NULL');
    expect(ganNhom.sql).toContain('"loaiThongTin" = v.loai');
    expect(ganNhom.thamSo).toEqual([
      ['a', 'b', 'd', 'e'],
      ['Tố giác', 'Tố giác', 'Tố giác', 'Khiếu nại (QĐ tố tụng)'],
      [LoaiDon.PHAN_ANH, LoaiDon.PHAN_ANH, LoaiDon.PHAN_ANH, LoaiDon.KHIEU_NAI],
    ]);
    // Câu UPDATE không được đụng `updatedAt` — hàng nghìn hồ sơ không ai sửa sẽ ngập "sửa gần đây".
    for (const c of ghi) expect(c.sql).not.toContain('updatedAt');
    expect(kq.daGhi).toEqual({ muc: 2, loai: 2, nhom: 4 });
  });

  /**
   * Soát 15/09/2026: `skipDuplicates` bỏ LẶNG LẼ mục đụng mã (một lượt tạo nhanh chen giữa lúc đọc
   * và lúc ghi). Đi tiếp thì hồ sơ bị đổi sang một tên không có trong danh mục — ô chọn không hiện
   * được. Thiếu mục là dừng trước khi đụng hồ sơ; chạy lại thì đọc danh mục mới và đủ.
   */
  it('ghi thật: createMany tạo thiếu mục → dừng, KHÔNG đụng hồ sơ', async () => {
    const { prisma, ghi, createMany } = gia({ hoSo: HO_SO });
    createMany.mockImplementationOnce(() => Promise.resolve({ count: 1 }));

    await expect(napLoaiThongTin(prisma, true, csv)).rejects.toThrow(
      /2 mục.*1/,
    );
    expect(ghi).toEqual([]);
  });

  it('ghi thật chia lô 500 hồ sơ mỗi câu UPDATE', async () => {
    const nhieu = Array.from({ length: 1001 }, (_, i) => ({
      id: `h${i}`,
      stt: `2025-${i}`,
      loaiThongTin: 'Đề nghị',
      petitionType: null,
      tomTat: null,
    }));
    const { prisma, ghi } = gia({ hoSo: nhieu });
    await napLoaiThongTin(prisma, true, csv);
    expect(ghi.map((c) => (c.thamSo[0] as unknown[]).length)).toEqual([
      500, 500, 1,
    ]);
  });

  it('không có mục mới thì không gọi createMany', async () => {
    const { prisma, createMany } = gia({
      hoSo: [
        {
          id: 'a',
          stt: '1',
          loaiThongTin: 'Tố giác',
          petitionType: LoaiDon.PHAN_ANH,
          tomTat: null,
        },
      ],
      daCo: [{ name: 'Tố giác', code: 'LTT0001', metadata: {} }],
    });
    const kq = await napLoaiThongTin(prisma, true, csv);
    expect(createMany).not.toHaveBeenCalled();
    expect(kq.daGhi).toEqual({ muc: 0, loai: 0, nhom: 0 });
  });
});
