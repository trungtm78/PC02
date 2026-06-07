import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LegacyMigrationController } from './legacy-migration.controller';
import { LegacyMigrationService } from './legacy-migration.service';

const mockSvc = {
  dryRun: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
};

const adminReq = { user: { id: 'admin-1', role: 'ADMIN' } };
const superAdminReq = { user: { id: 'super-1', role: 'SUPER_ADMIN' } };
const officerReq = { user: { id: 'officer-1', role: 'INVESTIGATOR' } };
const noIdReq = { user: { id: undefined, role: 'ADMIN' } };

describe('LegacyMigrationController', () => {
  let controller: LegacyMigrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegacyMigrationController],
      providers: [{ provide: LegacyMigrationService, useValue: mockSvc }],
    }).compile();
    controller = module.get<LegacyMigrationController>(LegacyMigrationController);
    jest.clearAllMocks();
    mockSvc.dryRun.mockReturnValue({ totalRecords: 0, willCreatePetitions: 0, willCreateIncidents: 0, willCreateCases: 0, warningsCount: 0, warnings: [], duplicateLegacyIds: [], missingIdCount: 0 });
    mockSvc.commit.mockResolvedValue({ created: {}, skipped: 0, errors: [] });
    mockSvc.rollback.mockResolvedValue({ deleted: 0 });
  });

  // ---- authz -----------------------------------------------------------------

  describe('assertAdmin guard', () => {
    it('ADMIN được phép gọi dryRun', () => {
      expect(() => controller.dryRun({ records: [] }, adminReq)).not.toThrow();
    });

    it('SUPER_ADMIN cũng được phép gọi dryRun', () => {
      expect(() => controller.dryRun({ records: [] }, superAdminReq)).not.toThrow();
    });

    it('INVESTIGATOR → ForbiddenException', () => {
      expect(() => controller.dryRun({ records: [] }, officerReq)).toThrow(ForbiddenException);
    });

    it('ADMIN không có id → UnauthorizedException', () => {
      expect(() => controller.dryRun({ records: [] }, noIdReq)).toThrow(UnauthorizedException);
    });
  });

  // ---- dryRun ---------------------------------------------------------------

  describe('dryRun', () => {
    it('gọi service.dryRun với records', () => {
      const records = [{ id: '1', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }];
      controller.dryRun({ records }, adminReq);
      expect(mockSvc.dryRun).toHaveBeenCalledWith(records);
    });

    it('truyền mảng rỗng khi body.records undefined', () => {
      controller.dryRun({}, adminReq);
      expect(mockSvc.dryRun).toHaveBeenCalledWith([]);
    });
  });

  // ---- commit ---------------------------------------------------------------

  describe('commit', () => {
    it('gọi service.commit với records và actorId', async () => {
      const records = [{ id: '1', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }];
      await controller.commit({ records }, adminReq);
      expect(mockSvc.commit).toHaveBeenCalledWith(records, 'admin-1');
    });

    it('SUPER_ADMIN actorId được truyền đúng', async () => {
      await controller.commit({ records: [] }, superAdminReq);
      expect(mockSvc.commit).toHaveBeenCalledWith([], 'super-1');
    });
  });

  // ---- rollback -------------------------------------------------------------

  describe('rollback', () => {
    it('gọi service.rollback với legacyIds và actorId', async () => {
      await controller.rollback({ legacyIds: ['L-001', 'L-002'] }, adminReq);
      expect(mockSvc.rollback).toHaveBeenCalledWith(['L-001', 'L-002'], 'admin-1');
    });

    it('truyền mảng rỗng khi body.legacyIds undefined', async () => {
      await controller.rollback({}, adminReq);
      expect(mockSvc.rollback).toHaveBeenCalledWith([], 'admin-1');
    });
  });
});
