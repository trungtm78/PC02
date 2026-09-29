import { buildControllerModule } from '../test-utils/controller-test-helpers';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { Response } from 'express';
import { CaseProvenance, CaseType } from '@prisma/client';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

const mockService = {
  xuatDanhSach: jest.fn(),
  getList: jest.fn(),
  getStats: jest.fn(),
  getById: jest.fn(),
  getStatusHistory: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  tdcBackfill: jest.fn(),
  assignCase: jest.fn(),
};

const mockJourneyService = { getJourney: jest.fn() };
const mockDynamicExport = {
  exportEntityDocuments: jest.fn(),
  exportBatchByCodes: jest.fn<
    Promise<void>,
    [
      string,
      string[],
      string[],
      (id: string) => Promise<unknown>,
      string,
      Response,
    ]
  >(),
  listExportableTemplates: jest.fn(),
};

const mockUser: AuthUser = {
  id: 'user-001',
  email: 'test@pc02.local',
  role: 'OFFICER',
  roleId: 'role-001',
};

const makeReq = (): ScopedRequest =>
  ({
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    user: mockUser,
    dataScope: {
      teamIds: [],
      userIds: [],
      writableTeamIds: [],
      writableUserIds: [],
    },
  }) as unknown as ScopedRequest;

describe('CasesController — delegation', () => {
  let controller: CasesController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      CasesController,
      CasesService,
      mockService,
      [
        { token: CasesJourneyService, mock: mockJourneyService },
        { token: DynamicExportService, mock: mockDynamicExport },
      ],
    );
    controller = module.get(CasesController);
    jest.clearAllMocks();
  });

  it('batch Word export rechecks scope and Case type for each selected record', async () => {
    const req = makeReq();
    const res = { setHeader: jest.fn() } as unknown as Response;
    await controller.exportDocumentBatch(
      {
        caseIds: ['c1'],
        docTypes: ['MAU_58'],
        caseType: CaseType.UY_THAC_DIEU_TRA,
      },
      mockUser,
      req,
      res,
    );
    expect(mockDynamicExport.exportBatchByCodes).toHaveBeenCalledWith(
      'VU_AN',
      ['MAU_58'],
      ['c1'],
      expect.any(Function),
      mockUser.id,
      res,
    );
    const loadRecord = mockDynamicExport.exportBatchByCodes.mock.calls[0][3];
    mockService.getById.mockResolvedValue({
      data: { id: 'c1', caseType: CaseType.UY_THAC_DIEU_TRA },
    });
    await expect(loadRecord('c1')).resolves.toMatchObject({ id: 'c1' });
    expect(mockService.getById).toHaveBeenCalledWith('c1', req.dataScope);
    mockService.getById.mockResolvedValue({
      data: { id: 'c1', caseType: CaseType.REGULAR },
    });
    await expect(loadRecord('c1')).rejects.toThrow();
  });

  it('requires separate full export permission and rejects oversized Word batches', async () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      CasesController.prototype,
      'xuatDayDu',
    )?.value;
    if (typeof handler !== 'function') {
      throw new Error('xuatDayDu handler missing');
    }
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      { action: 'read', subject: 'Case' },
      { action: 'export_full', subject: 'Case' },
    ]);
    await expect(
      controller.exportDocumentBatch(
        {
          caseIds: Array.from({ length: 101 }, () => 'c'),
          docTypes: ['MAU_58'],
          caseType: CaseType.REGULAR,
        },
        mockUser,
        makeReq(),
        {} as Response,
      ),
    ).rejects.toThrow();
    expect(mockDynamicExport.exportBatchByCodes).not.toHaveBeenCalled();
  });

  it('exportDocuments() load case (scope) rồi delegate dynamicExport (VU_AN)', async () => {
    const record = { id: 'c1', caseCode: 'VA-1' };
    mockService.getById.mockResolvedValue({ success: true, data: record }); // getById wrap {success,data}
    const req = makeReq();
    const res = {
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    await controller.exportDocuments(
      'c1',
      {
        templateIds: ['t1', 't2'],
        mode: 'zip',
        manualValues: { x: '1' },
      },
      req,
      res,
      mockUser,
    );
    expect(mockService.getById).toHaveBeenCalledWith('c1', req.dataScope);
    // record được UNWRAP (.data) trước khi truyền dynamicExport (codex P1).
    expect(mockDynamicExport.exportEntityDocuments).toHaveBeenCalledWith(
      'VU_AN',
      'c1',
      record,
      ['t1', 't2'],
      'zip',
      mockUser.id,
      { x: '1' },
      res,
    );
  });

  it('exportDocuments() mode mặc định merged + manualValues rỗng', async () => {
    mockService.getById.mockResolvedValue({ id: 'c1' });
    const res = {
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    await controller.exportDocuments(
      'c1',
      { templateIds: ['t1'] },
      makeReq(),
      res,
      mockUser,
    );
    const call = (
      mockDynamicExport.exportEntityDocuments.mock.calls as unknown[][]
    )[0];
    expect(call[4]).toBe('merged');
    expect(call[6]).toEqual({});
  });

  it('listExportTemplates() delegate dynamicExport (VU_AN) — quyền read Case', async () => {
    const rows = [{ id: 't1', code: 'QD01' }];
    mockDynamicExport.listExportableTemplates.mockResolvedValue(rows);
    await expect(controller.listExportTemplates()).resolves.toBe(rows);
    expect(mockDynamicExport.listExportableTemplates).toHaveBeenCalledWith(
      'VU_AN',
    );
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({}, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getStats() delegates to service.getStats with query and dataScope', async () => {
    mockService.getStats.mockResolvedValue({ total: 0, byStatus: {} });
    const req = makeReq();
    await controller.getStats({}, req);
    expect(mockService.getStats).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getStats() requires read:Case permission (RBAC metadata)', () => {
    // Reflect on Nest decorator metadata: @RequirePermissions enforces guard
    // matches action: 'read' subject: 'Case' — prevents 200 instead of 403
    // when caller lacks Case read permission (review finding: leak via stats).
    const handler: unknown = Object.getOwnPropertyDescriptor(
      CasesController.prototype,
      'getStats',
    )?.value;
    if (typeof handler !== 'function')
      throw new Error('getStats handler missing');
    const perms: unknown = Reflect.getMetadata('permissions', handler);
    expect(perms).toEqual([{ action: 'read', subject: 'Case' }]);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'c1' } });
    const req = makeReq();
    await controller.create(
      { name: 'Test', caseProvenance: CaseProvenance.DIRECT_DISCOVERY },
      mockUser,
      req,
    );
    expect(mockService.create).toHaveBeenCalledWith(
      { name: 'Test', caseProvenance: CaseProvenance.DIRECT_DISCOVERY },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      expect.anything(), // v0.33: dataScope param
    );
  });

  it('assignCase() delegates to service.assignCase with id, dto, userId', async () => {
    mockService.assignCase.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignCase(
      'case-1',
      { assignedTeamId: 'team-1', investigatorId: 'inv-1' },
      mockUser,
      req,
    );
    expect(mockService.assignCase).toHaveBeenCalledWith(
      'case-1',
      { assignedTeamId: 'team-1', investigatorId: 'inv-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('getStatusHistory() delegates to service.getStatusHistory', async () => {
    mockService.getStatusHistory.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getStatusHistory('case-1', req);
    // Phạm vi dữ liệu PHẢI được chuyển xuống (soát IDOR 19/09/2026).
    expect(mockService.getStatusHistory).toHaveBeenCalledWith(
      'case-1',
      req.dataScope,
    );
  });

  // Xuất Excel theo bộ lọc (18/09/2026): controller chuyển ĐÚNG bộ lọc, phạm vi dữ liệu và người xuất
  // (ghi nhật ký kiểm toán) xuống service.
  it('xuatDanhSach() chuyển bộ lọc + phạm vi + người xuất xuống service', async () => {
    mockService.xuatDanhSach.mockResolvedValue(undefined);
    const req = makeReq();
    const nguoiXuat = mockUser;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const query = { cot: 'a,b', tk: ['x~y'] };
    await controller.xuatDanhSach(query, nguoiXuat, req, res);
    expect(mockService.xuatDanhSach).toHaveBeenCalledWith(
      query,
      req.dataScope,
      res,
      {
        userId: nguoiXuat.id,
        ipAddress: '127.0.0.1',
        userAgent: 'jest-test',
      },
    );
  });
});
