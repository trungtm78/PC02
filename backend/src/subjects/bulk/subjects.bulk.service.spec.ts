import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SubjectsBulkService } from './subjects.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

describe('SubjectsBulkService.bulkDelete — v0.51', () => {
  let service: SubjectsBulkService;
  let mockPrisma: any;
  let mockAudit: any;

  const adminScope: DataScope = {
    userIds: [],
    teamIds: [],
    writableTeamIds: [],
    canDispatch: true,
    isWardOfficer: false,
  } as DataScope;

  beforeEach(async () => {
    mockPrisma = {
      subject: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's-1', fullName: 'A' },
          { id: 's-2', fullName: 'B' },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) =>
        cb({
          subject: { update: jest.fn().mockResolvedValue({ id: 'mocked' }) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }),
      ),
    };
    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'b-s-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<SubjectsBulkService>(SubjectsBulkService);
  });

  it('deletes 2 subjects với BULK_DELETE header', async () => {
    const result = await service.bulkDelete({
      ids: ['s-1', 's-2'],
      reason: 'gỡ trùng lặp',
      actorId: 'actor',
      dataScope: adminScope,
    });
    expect(result.succeeded).toHaveLength(2);
    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'Subject', action: 'BULK_DELETE' }),
    );
  });

  it('skips out-of-scope với PERMISSION', async () => {
    mockPrisma.subject.findMany.mockResolvedValue([
      { id: 's-1', fullName: 'A' },
    ]);
    const result = await service.bulkDelete({
      ids: ['s-1', 's-2'],
      reason: 'gỡ trùng lặp',
      actorId: 'actor',
      dataScope: adminScope,
    });
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ id: 's-2', reason: 'PERMISSION' }),
    );
  });

  it('rejects empty + > 100', async () => {
    await expect(
      service.bulkDelete({
        ids: [],
        reason: 'ok 10 chars',
        actorId: 'a',
        dataScope: adminScope,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.bulkDelete({
        ids: Array.from({ length: 101 }, (_, i) => `s-${i}`),
        reason: 'ok 10 chars',
        actorId: 'a',
        dataScope: adminScope,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
