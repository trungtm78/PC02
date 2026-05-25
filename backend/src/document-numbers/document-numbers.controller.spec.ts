import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DocumentNumbersController } from './document-numbers.controller';
import { DocumentNumbersService } from './document-numbers.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

const adminUser: AuthUser = {
  id: 'user-001',
  email: 'admin@test.com',
  role: 'ADMIN',
  roleId: 'role-001',
};

const staffUser: AuthUser = {
  id: 'user-002',
  email: 'staff@test.com',
  role: 'OFFICER',
  roleId: 'role-002',
};

const mockCtx = { userId: 'user-001', workId: 'CB-001' };

const mockService = {
  draft: jest.fn(),
  commit: jest.fn(),
  getLog: jest.fn(),
  updateLogDocumentId: jest.fn(),
  getTemplates: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  preview: jest.fn(),
  getStats: jest.fn(),
  resetCounter: jest.fn(),
  getLogs: jest.fn(),
  buildCtx: jest.fn().mockResolvedValue(mockCtx),
};

describe('DocumentNumbersController', () => {
  let controller: DocumentNumbersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentNumbersController],
      providers: [{ provide: DocumentNumbersService, useValue: mockService }],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DocumentNumbersController>(DocumentNumbersController);
    jest.clearAllMocks();
    mockService.buildCtx.mockResolvedValue(mockCtx);
  });

  describe('draft()', () => {
    it('delegates to service.draft with built ctx', async () => {
      mockService.draft.mockResolvedValue({ previewNumber: 'VV-2026-00001', isDraft: true, templateId: 'tpl-001' });

      const result = await controller.draft({ documentType: 'INCIDENT' }, adminUser);

      expect(mockService.buildCtx).toHaveBeenCalledWith(adminUser.id);
      expect(mockService.draft).toHaveBeenCalledWith('INCIDENT', mockCtx);
      expect(result.isDraft).toBe(true);
    });
  });

  describe('commit()', () => {
    it('delegates to service.commit with built ctx', async () => {
      mockService.commit.mockResolvedValue({ number: 'VV-2026-00001', logId: 'log-001', changed: false });

      const result = await controller.commit({ documentType: 'INCIDENT' }, adminUser);

      expect(mockService.buildCtx).toHaveBeenCalledWith(adminUser.id);
      expect(mockService.commit).toHaveBeenCalledWith('INCIDENT', mockCtx, expect.any(Object));
      expect(result.logId).toBe('log-001');
    });
  });

  describe('getTemplates()', () => {
    it('returns template list for any authenticated user', async () => {
      mockService.getTemplates.mockResolvedValue([]);

      const result = await controller.getTemplates();

      expect(result).toEqual([]);
      expect(mockService.getTemplates).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTemplate()', () => {
    const dto = {
      name: 'Mã vụ việc',
      documentType: 'INCIDENT',
      segments: [],
      counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 99999, padding: 5 },
    };

    it('creates template when called by ADMIN', async () => {
      mockService.createTemplate.mockResolvedValue({ id: 'new-tpl', ...dto });

      const result = await controller.createTemplate(dto as any, adminUser);

      expect(mockService.createTemplate).toHaveBeenCalledWith(dto, adminUser.id);
      expect(result.id).toBe('new-tpl');
    });

    it('throws ForbiddenException when called by non-ADMIN', async () => {
      await expect(controller.createTemplate(dto as any, staffUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockService.createTemplate).not.toHaveBeenCalled();
    });
  });

  describe('updateTemplate()', () => {
    it('updates template when called by ADMIN', async () => {
      mockService.updateTemplate.mockResolvedValue({ id: 'tpl-001', name: 'Updated' });

      const result = await controller.updateTemplate('tpl-001', { name: 'Updated' } as any, adminUser);

      expect(mockService.updateTemplate).toHaveBeenCalledWith('tpl-001', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenException when called by non-ADMIN', async () => {
      await expect(
        controller.updateTemplate('tpl-001', {} as any, staffUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTemplate()', () => {
    it('deletes template when called by ADMIN', async () => {
      mockService.deleteTemplate.mockResolvedValue({ id: 'tpl-001' });

      await controller.deleteTemplate('tpl-001', adminUser);

      expect(mockService.deleteTemplate).toHaveBeenCalledWith('tpl-001');
    });

    it('throws ForbiddenException when called by non-ADMIN', async () => {
      await expect(controller.deleteTemplate('tpl-001', staffUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('previewTemplate()', () => {
    it('returns preview number without requiring admin role', async () => {
      mockService.preview.mockResolvedValue({ previewNumber: 'VV-2026-00001' });

      const result = await controller.previewTemplate('tpl-001', staffUser);

      expect(mockService.buildCtx).toHaveBeenCalledWith(staffUser.id);
      expect(result.previewNumber).toBe('VV-2026-00001');
    });
  });

  describe('resetCounter()', () => {
    it('resets counter when called by ADMIN', async () => {
      mockService.resetCounter.mockResolvedValue(undefined);

      const result = await controller.resetCounter('tpl-001', adminUser);

      expect(mockService.resetCounter).toHaveBeenCalledWith('tpl-001');
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException when called by non-ADMIN', async () => {
      await expect(controller.resetCounter('tpl-001', staffUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateLogDocumentId()', () => {
    it('allows owner to update their own log', async () => {
      mockService.getLog.mockResolvedValue({ id: 'log-001', userId: staffUser.id });
      mockService.updateLogDocumentId.mockResolvedValue(undefined);

      const result = await controller.updateLogDocumentId('log-001', 'doc-001', staffUser);

      expect(mockService.updateLogDocumentId).toHaveBeenCalledWith('log-001', 'doc-001');
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException when non-owner non-admin tries to update', async () => {
      mockService.getLog.mockResolvedValue({ id: 'log-001', userId: 'other-user' });

      await expect(
        controller.updateLogDocumentId('log-001', 'doc-001', staffUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockService.updateLogDocumentId).not.toHaveBeenCalled();
    });

    it('allows ADMIN to update any log regardless of owner', async () => {
      mockService.getLog.mockResolvedValue({ id: 'log-001', userId: 'other-user' });
      mockService.updateLogDocumentId.mockResolvedValue(undefined);

      const result = await controller.updateLogDocumentId('log-001', 'doc-001', adminUser);

      expect(mockService.updateLogDocumentId).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('getLogs()', () => {
    it('returns paginated logs with default pagination', async () => {
      mockService.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

      const result = await controller.getLogs(undefined, undefined, undefined, undefined, '1', '20', adminUser);

      expect(mockService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
      expect(result.total).toBe(0);
    });

    it('admin can query any userId', async () => {
      mockService.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

      await controller.getLogs(undefined, 'user-999', undefined, undefined, '1', '20', adminUser);

      expect(mockService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-999' }),
      );
    });

    it('non-admin is scoped to own userId regardless of query param', async () => {
      mockService.getLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

      await controller.getLogs(undefined, 'user-999', undefined, undefined, '1', '20', staffUser);

      expect(mockService.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ userId: staffUser.id }),
      );
    });
  });
});
