import { PassThrough } from 'stream';
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

/**
 * Nút "Xuất Excel" trong khung Bộ lọc (anh yêu cầu 18/09/2026): tệp chứa ĐÚNG các dòng đang lọc, theo
 * thứ tự và các cột đang hiện trên màn.
 */
const dong = (id: string, stt: string, ten: string) => ({
  id,
  stt,
  sttCu: null,
  ngayDeXuat: new Date('2026-09-10T00:00:00Z'),
  nguonDon: 'Trực tiếp',
  senderName: ten,
  detailContent: 'Nội dung',
  donViGiaiQuyet: null,
  ketQuaXuLyKhac: null,
  enteredBy: {
    id: 'u1',
    firstName: 'Tuấn',
    lastName: 'Dương Trọng',
    username: 'tuan',
  },
  status: 'MOI_TIEP_NHAN',
  suspectedPerson: null,
  deadline: null,
  createdAt: new Date('2026-09-10T00:00:00Z'),
});

const mockPrisma = {
  petition: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
};
const audit = { log: jest.fn() };

function resGia() {
  const luong = new PassThrough();
  const phan: Buffer[] = [];
  luong.on('data', (c: Buffer) => phan.push(c));
  const res = Object.assign(luong, { setHeader: jest.fn() });
  const docSheet = async () => {
    await new Promise((r) => setImmediate(r));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.concat(phan) as never);
    return wb.worksheets[0];
  };
  return { res, docSheet };
}

describe('PetitionsService.xuatDanhSach', () => {
  let service: PetitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: audit },
        {
          provide: SettingsService,
          useValue: {
            getValue: jest.fn().mockResolvedValue(null),
            getKyThongKe: jest.fn().mockResolvedValue({
              ky: 'TAT_CA',
              truong: 'NGAY_TIEP_NHAN',
              tuNgay: null,
              denNgay: null,
            }),
          },
        },
        {
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { generate: jest.fn(), commitWithTx: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(PetitionsService);
  });

  it('xuất đúng cột đang hiện, đúng thứ tự dòng, cùng điều kiện lọc với danh sách, ghi nhật ký', async () => {
    mockPrisma.petition.count.mockResolvedValue(2);
    mockPrisma.petition.findMany
      .mockResolvedValueOnce([{ id: 'b' }, { id: 'a' }])
      .mockResolvedValueOnce([
        dong('a', '2026-11129', 'Lê Nguyễn Yến Thanh'),
        dong('b', '2026-11732', 'Kha Tử Thạnh'),
      ]);
    const { res, docSheet } = resGia();
    await service.xuatDanhSach(
      { enteredById: 'u1', cot: 'stt,senderName,enteredBy' } as never,
      null,
      res as never,
      { userId: 'actor' },
    );
    const sheet = await docSheet();
    expect(sheet.getRow(7).values).toEqual([
      undefined,
      'STT',
      'STT hồ sơ',
      'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      'Người nhập',
    ]);
    expect((sheet.getRow(8).values as unknown[]).slice(1)).toEqual([
      1,
      '26-11732',
      'Kha Tử Thạnh',
      'Dương Trọng Tuấn',
    ]);
    expect((sheet.getRow(9).values as unknown[]).slice(1)).toEqual([
      2,
      '26-11129',
      'Lê Nguyễn Yến Thanh',
      'Dương Trọng Tuấn',
    ]);
    // Cùng điều kiện với danh sách (Cán bộ nhập có mặt ở cả đếm lẫn lấy id).
    const whereDem = (
      mockPrisma.petition.count.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDem.enteredById).toBe('u1');
    // Hồ sơ bị xoá mềm GIỮA lúc lấy id và lúc đọc dòng thì không được lọt vào tệp.
    const whereDong = (
      mockPrisma.petition.findMany.mock.calls[1] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(whereDong.deletedAt).toBeNull();
    const nhatKy = (
      audit.log.mock.calls[0] as [
        { action: string; metadata: Record<string, unknown> },
      ]
    )[0];
    expect(nhatKy.action).toBe('PETITION_EXPORTED');
    expect(nhatKy.metadata).toMatchObject({ kind: 'danh-sach', soDong: 2 });
  });

  it('cột lạ → 400, không đọc CSDL', async () => {
    const { res } = resGia();
    await expect(
      service.xuatDanhSach({ cot: 'stt,matKhau' } as never, null, res as never),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.petition.count).not.toHaveBeenCalled();
  });
});
