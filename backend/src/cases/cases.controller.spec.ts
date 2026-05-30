import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';

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

describe('CasesController — delegation', () => {
  let controller: CasesController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      CasesController,
      CasesService,
      mockService,
      [{ token: CasesJourneyService, mock: mockJourneyService }],
    );
    controller = module.get(CasesController);
    jest.clearAllMocks();
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
