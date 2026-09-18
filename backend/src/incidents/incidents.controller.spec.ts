import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentsJourneyService } from './incidents-journey.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';

const mockService = {
  xuatDanhSach: jest.fn(),
  getList: jest.fn(),
  getStats: jest.fn(),
  getInvestigators: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateStatus: jest.fn(),
  mergeInto: jest.fn(),
  transferUnit: jest.fn(),
  assignInvestigator: jest.fn(),
  extendDeadline: jest.fn(),
  prosecute: jest.fn(),
};

const mockJourneyService = { getJourney: jest.fn() };
const mockDynamicExport = { exportEntityDocuments: jest.fn(), listExportableTemplates: jest.fn() };

describe('IncidentsController — delegation', () => {
  let controller: IncidentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      IncidentsController,
      IncidentsService,
      mockService,
      [
        { token: IncidentsJourneyService, mock: mockJourneyService },
        { token: DynamicExportService, mock: mockDynamicExport },
      ],
    );
    controller = module.get(IncidentsController);
    jest.clearAllMocks();
  });

  it('exportDocuments() load incident (scope) rồi delegate dynamicExport (VU_VIEC)', async () => {
    const record = { id: 'i1', code: 'VV-1' };
    mockService.getById.mockResolvedValue({ success: true, data: record }); // getById wrap {success,data}
    const req = makeReq();
    const res = { send: jest.fn(), setHeader: jest.fn() } as any;
    await controller.exportDocuments(
      'i1',
      { templateIds: ['t1'], mode: 'merged' } as any,
      req,
      res,
      mockUser as any,
    );
    expect(mockService.getById).toHaveBeenCalledWith('i1', req.dataScope);
    expect(mockDynamicExport.exportEntityDocuments).toHaveBeenCalledWith(
      'VU_VIEC', 'i1', record, ['t1'], 'merged', mockUser.id, {}, res,
    );
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('listExportTemplates() delegate dynamicExport (VU_VIEC) — quyền read Incident', async () => {
    const rows = [{ id: 't1', code: 'BB01' }];
    mockDynamicExport.listExportableTemplates.mockResolvedValue(rows);
    await expect(controller.listExportTemplates()).resolves.toBe(rows);
    expect(mockDynamicExport.listExportableTemplates).toHaveBeenCalledWith('VU_VIEC');
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'inc-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      expect.anything(), // v0.33: dataScope param
    );
  });

  it('updateStatus() delegates to service.updateStatus with id, dto, userId', async () => {
    mockService.updateStatus.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.updateStatus('inc-1', { status: 'RESOLVED' } as any, mockUser, req);
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      'inc-1',
      { status: 'RESOLVED' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('assignInvestigator() delegates to service.assignInvestigator', async () => {
    mockService.assignInvestigator.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignInvestigator('inc-1', { investigatorId: 'inv-1' } as any, mockUser, req);
    expect(mockService.assignInvestigator).toHaveBeenCalledWith(
      'inc-1',
      { investigatorId: 'inv-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  // Xuất Excel theo bộ lọc (18/09/2026): controller chuyển ĐÚNG bộ lọc, phạm vi dữ liệu và người xuất
  // (ghi nhật ký kiểm toán) xuống service.
  it('xuatDanhSach() chuyển bộ lọc + phạm vi + người xuất xuống service', async () => {
    mockService.xuatDanhSach.mockResolvedValue(undefined);
    const req = makeReq() as ScopedRequest;
    const nguoiXuat = mockUser as AuthUser;
    const res = { setHeader: jest.fn() } as never;
    const query = { cot: 'a,b', tk: ['x~y'] } as never;
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
