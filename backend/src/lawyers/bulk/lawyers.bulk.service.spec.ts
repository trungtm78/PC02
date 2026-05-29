import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LawyersBulkService } from './lawyers.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

describe('LawyersBulkService.bulkDelete — v0.51', () => {
  let service: LawyersBulkService;
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
      lawyer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'l-1', fullName: 'A', case: { id: 'c-1', assignedTeamId: 't-1', investigatorId: 'u-1' } },
          { id: 'l-2', fullName: 'B', case: { id: 'c-2', assignedTeamId: 't-2', investigatorId: 'u-2' } },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) =>
        cb({
          lawyer: { update: jest.fn().mockResolvedValue({ id: 'mocked' }) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        }),
      ),
    };
    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'b-l-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LawyersBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<LawyersBulkService>(LawyersBulkService);
  });

  it('deletes 2 lawyers với BULK_DELETE header', async () => {
    const result = await service.bulkDelete({
      ids: ['l-1', 'l-2'],
      reason: 'gỡ trùng lặp',
      actorId: 'actor',
      dataScope: adminScope,
    });
    expect(result.succeeded).toHaveLength(2);
    expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'Lawyer', action: 'BULK_DELETE' }),
    );
  });

  it('skips out-of-scope với PERMISSION', async () => {
    mockPrisma.lawyer.findMany.mockResolvedValue([
      { id: 'l-1', fullName: 'A', case: { id: 'c-1', assignedTeamId: 't-1', investigatorId: 'u-1' } },
    ]);
    const result = await service.bulkDelete({
      ids: ['l-1', 'l-2'],
      reason: 'gỡ trùng lặp',
      actorId: 'actor',
      dataScope: adminScope,
    });
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ id: 'l-2', reason: 'PERMISSION' }),
    );
  });

  it('rejects empty + > 100 ids', async () => {
    await expect(
      service.bulkDelete({ ids: [], reason: 'ok 10 chars', actorId: 'a', dataScope: adminScope }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.bulkDelete({
        ids: Array.from({ length: 101 }, (_, i) => `l-${i}`),
        reason: 'ok 10 chars',
        actorId: 'a',
        dataScope: adminScope,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
