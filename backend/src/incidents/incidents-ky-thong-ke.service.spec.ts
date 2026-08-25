import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { DeadlineRulesService } from '../deadline-rules/deadline-rules.service';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';

const mockPrisma = {
  incident: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((args: unknown[]) => Promise.all(args)),
};

/**
 * KỲ THỐNG KÊ ÁP CHO CẢ THỐNG KÊ LẪN DANH SÁCH — anh chốt 25/08/2026.
 *
 * Điều kiện ngày mà hai đường đi dựng ra phải GIỐNG HỆT nhau. Lệch một chút là thẻ nói một
 * con số còn danh sách ngay dưới nói con số khác, và không ai biết bên nào đúng. Ca kiểm so
 * chính điều kiện `where` của hai lời gọi, không so hai con số — hai con số có thể tình cờ
 * bằng nhau trên dữ liệu mẫu.
 */
describe('IncidentsService — kỳ thống kê áp giống nhau cho thống kê và danh sách', () => {
  it('cùng một kỳ thì điều kiện ngày của getStats và getList trùng khít', async () => {
    const ky = {
      ky: 'THANG_HIEN_TAI',
      truong: 'NGAY_TIEP_NHAN',
      tuNgay: '2026-08-01',
      denNgay: '2026-08-31',
    };
    const settings = { getValue: jest.fn(), getKyThongKe: jest.fn().mockResolvedValue(ky) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: SettingsService, useValue: settings },
        {
          provide: DeadlineRulesService,
          useValue: { getActiveByKey: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: DocumentNumbersService,
          useValue: { commitWithTx: jest.fn(), draft: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const svc = module.get<IncidentsService>(IncidentsService);

    jest.clearAllMocks();
    mockPrisma.incident.groupBy.mockResolvedValue([]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.count.mockResolvedValue(0);

    await svc.getStats({});
    const whereStats = mockPrisma.incident.groupBy.mock.calls[0][0].where;

    await svc.getList({});
    const whereList = mockPrisma.incident.findMany.mock.calls[0][0].where;

    expect(whereStats.ngayDeXuat).toBeDefined();
    expect(whereList.ngayDeXuat).toEqual(whereStats.ngayDeXuat);
  });
});
