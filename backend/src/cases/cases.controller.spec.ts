import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';

const mockService = {
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
const mockDynamicExport = { exportEntityDocuments: jest.fn() };

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

  it('exportDocuments() load case (scope) rồi delegate dynamicExport (VU_AN)', async () => {
    const record = { id: 'c1', caseCode: 'VA-1' };
    mockService.getById.mockResolvedValue({ success: true, data: record }); // getById wrap {success,data}
    const req = makeReq();
    const res = { send: jest.fn(), setHeader: jest.fn() } as any;
    await controller.exportDocuments(
      'c1',
      { templateIds: ['t1', 't2'], mode: 'zip', manualValues: { x: '1' } } as any,
      req,
      res,
      mockUser as any,
    );
    expect(mockService.getById).toHaveBeenCalledWith('c1', req.dataScope);
    // record được UNWRAP (.data) trước khi truyền dynamicExport (codex P1).
    expect(mockDynamicExport.exportEntityDocuments).toHaveBeenCalledWith(
      'VU_AN', 'c1', record, ['t1', 't2'], 'zip', mockUser.id, { x: '1' }, res,
    );
  });

  it('exportDocuments() mode mặc định merged + manualValues rỗng', async () => {
    mockService.getById.mockResolvedValue({ id: 'c1' });
    const res = { send: jest.fn(), setHeader: jest.fn() } as any;
    await controller.exportDocuments('c1', { templateIds: ['t1'] } as any, makeReq(), res, mockUser as any);
    const call = mockDynamicExport.exportEntityDocuments.mock.calls[0];
    expect(call[4]).toBe('merged');
    expect(call[6]).toEqual({});
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getStats() delegates to service.getStats with query and dataScope', async () => {
    mockService.getStats.mockResolvedValue({ total: 0, byStatus: {} });
    const req = makeReq();
    await controller.getStats({} as any, req);
    expect(mockService.getStats).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getStats() requires read:Case permission (RBAC metadata)', () => {
    // Reflect on Nest decorator metadata: @RequirePermissions enforces guard
    // matches action: 'read' subject: 'Case' — prevents 200 instead of 403
    // when caller lacks Case read permission (review finding: leak via stats).
    const perms = Reflect.getMetadata(
      'permissions',
      Object.getPrototypeOf(controller).getStats,
    );
    expect(perms).toEqual([{ action: 'read', subject: 'Case' }]);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'c1' } });
    const req = makeReq();
    await controller.create({ tenVuAn: 'Test' } as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      { tenVuAn: 'Test' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      expect.anything(), // v0.33: dataScope param
    );
  });

  it('assignCase() delegates to service.assignCase with id, dto, userId', async () => {
    mockService.assignCase.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignCase('case-1', { investigatorId: 'inv-1' } as any, mockUser, req);
    expect(mockService.assignCase).toHaveBeenCalledWith(
      'case-1',
      { investigatorId: 'inv-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('getStatusHistory() delegates to service.getStatusHistory', async () => {
    mockService.getStatusHistory.mockResolvedValue({ data: [] });
    await controller.getStatusHistory('case-1');
    expect(mockService.getStatusHistory).toHaveBeenCalledWith('case-1');
  });
});
