/**
 * SubjectsBulkService.bulkExport — F5 tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SubjectsBulkService } from './subjects.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

const mockPrisma = {
  subject: {
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
  return {
    setHeader: jest.fn(),
    end: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  } as any;
}

describe('SubjectsBulkService.bulkExport — F5', () => {
  let service: SubjectsBulkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get(SubjectsBulkService);
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
        ids: Array.from({ length: 1001 }, (_, i) => `subj-${i}`),
        dataScope: null,
        res: mockRes(),
        actorId: 'u1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('audits SUBJECT_BULK_EXPORTED', async () => {
    await service.bulkExport({
      ids: ['subj-1'],
      dataScope: null,
      res: mockRes(),
      actorId: 'u1',
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUBJECT_BULK_EXPORTED',
        subject: 'Subject',
        metadata: expect.objectContaining({ idsRequested: 1 }),
      }),
    );
  });

  it('scope filter applied', async () => {
    await service.bulkExport({
      ids: ['subj-1'],
      dataScope: { userIds: ['u1'], teamIds: [], writableTeamIds: [] },
      res: mockRes(),
      actorId: 'u1',
    });
    const whereArg = mockPrisma.subject.findMany.mock.calls[0][0].where;
    expect(whereArg.case).toBeDefined();
  });

  it('sets xlsx headers', async () => {
    const res = mockRes();
    await service.bulkExport({
      ids: ['subj-1'],
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
      expect.stringContaining('DoiTuong_'),
    );
  });
});
