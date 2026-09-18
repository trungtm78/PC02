import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import {
  chonCotXuat,
  xuatDanhSachExcel,
  type KhaiCotXuat,
} from './xuat-danh-sach';

/**
 * Anh yêu cầu 18/09/2026: nút Xuất Excel trong khung Bộ lọc xuất ĐÚNG dữ liệu đang lọc. Một bộ xuất
 * dùng chung cho Đơn thư, Vụ việc, Vụ án: kiểm cột, trần dòng, giữ đúng thứ tự danh sách, ghi luồng.
 */
type Dong = { id: string; ma: string; ten: string | null };
const KHAI: KhaiCotXuat<Dong>[] = [
  { key: 'ma', tieuDe: 'STT', rong: 12, doc: (d) => d.ma },
  { key: 'ten', tieuDe: 'Tên', rong: 30, doc: (d) => d.ten ?? '' },
];

function resGia() {
  const luong = new PassThrough();
  const phan: Buffer[] = [];
  luong.on('data', (c: Buffer) => phan.push(c));
  const headers: Record<string, string> = {};
  const res = Object.assign(luong, {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
  });
  const docSheet = async () => {
    await new Promise((r) => setImmediate(r));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(phan) as never);
    return wb.worksheets[0];
  };
  return { res, headers, docSheet };
}

describe('chonCotXuat', () => {
  it('không chọn cột → mọi cột khai', () => {
    expect(chonCotXuat(KHAI, undefined).map((c) => c.key)).toEqual([
      'ma',
      'ten',
    ]);
  });
  it('giữ đúng thứ tự cột người dùng đang xem', () => {
    expect(chonCotXuat(KHAI, ['ten', 'ma']).map((c) => c.key)).toEqual([
      'ten',
      'ma',
    ]);
  });
  it('cột lạ → 400, không lặng lẽ bỏ qua', () => {
    expect(() => chonCotXuat(KHAI, ['ma', 'khong-co'])).toThrow(
      BadRequestException,
    );
  });
});

describe('xuatDanhSachExcel', () => {
  it('ghi đủ dòng, ĐÚNG thứ tự danh sách dù lô trả về lộn xộn, kèm STT dòng', async () => {
    const { res, headers, docSheet } = resGia();
    const tong = await xuatDanhSachExcel<Dong>({
      res: res as never,
      tenTep: 'danh-sach-don-thu.xlsx',
      tenSheet: 'Đơn thư',
      tieuDe: 'Danh sách đơn thư',
      phuDe: 'Tháng 9/2026',
      cot: KHAI,
      demTong: () => Promise.resolve(3),
      layIdTheoThuTu: () => Promise.resolve(['c', 'a', 'b']),
      layDong: (ids) =>
        Promise.resolve(
          [
            { id: 'a', ma: '26-1', ten: 'An' },
            { id: 'b', ma: '26-2', ten: null },
            { id: 'c', ma: '26-3', ten: 'Cường' },
          ].filter((d) => ids.includes(d.id)),
        ),
      lo: 2,
    });
    expect(tong).toBe(3);
    expect(headers['content-disposition']).toContain(
      "filename*=UTF-8''danh-sach-don-thu.xlsx",
    );
    const sheet = await docSheet();
    const dong = [8, 9, 10].map((i) => sheet.getRow(i).values as unknown[]);
    // Ô chuỗi rỗng đọc lại từ tệp thành `undefined` (Excel không lưu ô rỗng).
    expect(dong.map((v) => [v[1], v[2], v[3] ?? ''])).toEqual([
      [1, '26-3', 'Cường'],
      [2, '26-1', 'An'],
      [3, '26-2', ''],
    ]);
    expect(sheet.getRow(7).getCell(2).value).toBe('STT');
  });

  it('thiết lập trang in như mọi tệp mẫu BCA: A4 ngang, vừa một trang bề ngang', async () => {
    const { res, docSheet } = resGia();
    await xuatDanhSachExcel<Dong>({
      res: res as never,
      tenTep: 'a.xlsx',
      tenSheet: 'Đơn thư',
      tieuDe: 'Danh sách',
      phuDe: '',
      cot: KHAI,
      demTong: () => Promise.resolve(1),
      layIdTheoThuTu: () => Promise.resolve(['a']),
      layDong: () => Promise.resolve([{ id: 'a', ma: '26-1', ten: 'An' }]),
    });
    const trangIn = (await docSheet()).pageSetup;
    expect(trangIn.paperSize).toBe(9);
    expect(trangIn.orientation).toBe('landscape');
    expect(trangIn.fitToPage).toBe(true);
    expect(trangIn.fitToWidth).toBe(1);
  });

  it('vượt trần → 400 nói rõ số dòng, KHÔNG ghi gì ra phản hồi', async () => {
    const { res, headers } = resGia();
    await expect(
      xuatDanhSachExcel<Dong>({
        res: res as never,
        tenTep: 'x.xlsx',
        tenSheet: 'x',
        tieuDe: 'x',
        phuDe: '',
        cot: KHAI,
        demTong: () => Promise.resolve(60_000),
        layIdTheoThuTu: () => Promise.reject(new Error('không được gọi')),
        layDong: () => Promise.reject(new Error('không được gọi')),
      }),
    ).rejects.toThrow(/60\.000.*50\.000/);
    expect(headers['content-disposition']).toBeUndefined();
  });

  it('không có dòng nào → 400 (không xuất tệp rỗng)', async () => {
    const { res } = resGia();
    await expect(
      xuatDanhSachExcel<Dong>({
        res: res as never,
        tenTep: 'x.xlsx',
        tenSheet: 'x',
        tieuDe: 'x',
        phuDe: '',
        cot: KHAI,
        demTong: () => Promise.resolve(0),
        layIdTheoThuTu: () => Promise.resolve([]),
        layDong: () => Promise.resolve([]),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lỗi giữa lúc ghi (đã gửi header) → huỷ luồng để trình duyệt thấy tải hỏng, ném lỗi', async () => {
    const { res } = resGia();
    const huy = jest.spyOn(res, 'destroy');
    const baoLoi = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      xuatDanhSachExcel<Dong>({
        res: res as never,
        tenTep: 'x.xlsx',
        tenSheet: 'x',
        tieuDe: 'x',
        phuDe: '',
        cot: KHAI,
        demTong: () => Promise.resolve(2),
        layIdTheoThuTu: () => Promise.resolve(['a', 'b']),
        layDong: () => Promise.reject(new Error('mất kết nối giữa chừng')),
      }),
    ).rejects.toThrow('mất kết nối giữa chừng');
    expect(huy).toHaveBeenCalled();
    baoLoi.mockRestore();
  });
});
