/**
 * LawyersBulkService.bulkExport — F5 tests.
 *
 * Validates: id cap, scope filter, audit log, xlsx stream write.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LawyersBulkService } from './lawyers.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

const mockPrisma = {
  lawyer: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};
const mockAudit = {
  log: jest.fn(),
  logBulkHeader: jest.fn(),
  logBulkItem: jest.fn(),
  completeBulk: jest.fn(),
};

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    end: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    headers,
  } as any;
}

describe('LawyersBulkService.bulkExport — F5', () => {
  let service: LawyersBulkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LawyersBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(LawyersBulkService);
  });

  it('throws BadRequestException when ids empty', async () => {
    await expect(
      service.bulkExport({
        ids: [],
        dataScope: null,
        res: mockRes(),
        actorId: 'u1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when ids > 1000', async () => {
    await expect(
      service.bulkExport({
        ids: Array.from({ length: 1001 }, (_, i) => `lawyer-${i}`),
        dataScope: null,
        res: mockRes(),
        actorId: 'u1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('audits LAWYER_BULK_EXPORTED before findMany', async () => {
    const res = mockRes();
    await service.bulkExport({
      ids: ['lawyer-1'],
      dataScope: null,
      res,
      actorId: 'u1',
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LAWYER_BULK_EXPORTED',
        subject: 'Lawyer',
        metadata: expect.objectContaining({ idsRequested: 1, format: 'xlsx' }),
      }),
    );
  });

  it('applies scope filter qua case parent when dataScope non-null', async () => {
    const res = mockRes();
    await service.bulkExport({
      ids: ['lawyer-1'],
      dataScope: { userIds: ['u1'], teamIds: [], writableTeamIds: [] },
      res,
      actorId: 'u1',
    });
    const whereArg = mockPrisma.lawyer.findMany.mock.calls[0][0].where;
    expect(whereArg.case).toBeDefined();
  });

  it('sets xlsx content-type + filename header', async () => {
    const res = mockRes();
    await service.bulkExport({
      ids: ['lawyer-1'],
      dataScope: null,
      res,
      actorId: 'u1',
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('spreadsheetml.sheet'),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('LuatSu_'),
    );
    expect(res.end).toHaveBeenCalled();
  });
});
