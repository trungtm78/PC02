import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PetitionsBulkService } from './petitions.bulk.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';

describe('PetitionsBulkService — v0.48 B5', () => {
  let service: PetitionsBulkService;
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
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'u-1', isActive: true }),
      },
      petition: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p-1' },
          { id: 'p-2' },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: any) => {
        return cb({
          petition: { update: jest.fn().mockResolvedValue({ id: 'mocked' }) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        });
      }),
    };
    mockAudit = {
      logBulkHeader: jest.fn().mockResolvedValue({ bulkOperationId: 'bulk-p-1' }),
      logBulkItem: jest.fn().mockResolvedValue(undefined),
      completeBulk: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetitionsBulkService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<PetitionsBulkService>(PetitionsBulkService);
  });

  describe('bulkAssign', () => {
    it('happy path: assigns 2 petitions, returns 2 succeeded', async () => {
      const result = await service.bulkAssign({
        ids: ['p-1', 'p-2'],
        assignedToId: 'u-1',
        actorId: 'actor',
        dataScope: adminScope,
        reason: 'phân công xử lý',
      });
      expect(result.succeeded).toHaveLength(2);
      expect(mockAudit.logBulkHeader).toHaveBeenCalledWith(
        expect.objectContaining({ resource: 'Petition', action: 'BULK_ASSIGN' }),
      );
    });

    it('rejects 400 khi assignedToId không active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.bulkAssign({
          ids: ['p-1'],
          assignedToId: 'u-x',
          actorId: 'actor',
          dataScope: adminScope,
          reason: 'phân công',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockAudit.logBulkHeader).not.toHaveBeenCalled();
    });

    it('skips out-of-scope petitions PERMISSION', async () => {
      mockPrisma.petition.findMany.mockResolvedValue([{ id: 'p-1' }]);
      const result = await service.bulkAssign({
        ids: ['p-1', 'p-2'],
        assignedToId: 'u-1',
        actorId: 'actor',
        dataScope: adminScope,
        reason: 'phân công',
      });
      expect(result.succeeded.map((s) => s.id)).toEqual(['p-1']);
      expect(result.skipped).toEqual([{ id: 'p-2', reason: 'PERMISSION' }]);
    });
  });

  describe('bulkExport', () => {
    let mockRes: any;
    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        destroy: jest.fn(),
        headersSent: false,
        write: jest.fn((_c: any, cb?: any) => { if (cb) cb(); return true; }),
        end: jest.fn((cb?: any) => { if (cb) cb(); }),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      };
      mockPrisma.petition.findMany.mockResolvedValue([
        {
          id: 'p-1',
          stt: 'DT-2026-001',
          senderName: 'Nguyễn A',
          petitionType: 'TO_GIAC',
          status: 'MOI_TIEP_NHAN',
          receivedDate: new Date('2026-01-15'),
          unit: 'PC02',
          assignedTo: { firstName: 'B', lastName: 'Lê' },
        },
      ]);
    });

    it('queries with id IN + scope filter + writes xlsx + audit PETITION_BULK_EXPORTED', async () => {
      await service.bulkExport({
        ids: ['p-1'],
        dataScope: adminScope,
        res: mockRes as any,
        actorId: 'actor',
      });
      expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['p-1'] } }),
        }),
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PETITION_BULK_EXPORTED' }),
      );
    });

    it('rejects empty + > 1000 ids', async () => {
      await expect(
        service.bulkExport({
          ids: [],
          dataScope: adminScope,
          res: mockRes as any,
          actorId: 'actor',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.bulkExport({
          ids: Array.from({ length: 1001 }, (_, i) => `p-${i}`),
          dataScope: adminScope,
          res: mockRes as any,
          actorId: 'actor',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
