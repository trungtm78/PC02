import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $executeRaw: jest.fn().mockResolvedValue(1),
  auditLog: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('wrapUpdate', () => {
    it('calls fetchFn → updateFn → log with before/after in metadata', async () => {
      const before = { name: 'old name', status: 'TIEP_NHAN' };
      const after = { name: 'new name', status: 'DANG_DIEU_TRA' };

      const fetchFn = jest.fn().mockResolvedValue(before);
      const updateFn = jest.fn().mockResolvedValue(after);

      const result = await service.wrapUpdate({
        fetchFn,
        updateFn,
        action: 'CASE_UPDATED',
        subject: 'Case',
        subjectId: 'case-001',
        userId: 'actor-001',
      });

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(result).toBe(after);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      // The raw query call receives before/after in the metadata JSON arg
      const rawArgs = mockPrisma.$executeRaw.mock.calls[0];
      const metaArg = rawArgs.find((a: unknown) => typeof a === 'string' && a.includes('"before"'));
      expect(metaArg).toBeDefined();
    });

    it('does not log when updateFn throws — error propagates', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ id: '1' });
      const updateFn = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        service.wrapUpdate({
          fetchFn,
          updateFn,
          action: 'CASE_UPDATED',
          subject: 'Case',
          subjectId: 'case-001',
          userId: 'actor-001',
        }),
      ).rejects.toThrow('DB error');

      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('returns the value from updateFn', async () => {
      const expectedResult = { id: 'case-001', name: 'Updated' };
      const fetchFn = jest.fn().mockResolvedValue({ id: 'case-001', name: 'Original' });
      const updateFn = jest.fn().mockResolvedValue(expectedResult);

      const result = await service.wrapUpdate({
        fetchFn,
        updateFn,
        action: 'CASE_UPDATED',
        subject: 'Case',
        subjectId: 'case-001',
        userId: 'actor-001',
      });

      expect(result).toBe(expectedResult);
    });
  });
});
