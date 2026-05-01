import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

const mockService = {
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

describe('IncidentsController — delegation', () => {
  let controller: IncidentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(IncidentsController, IncidentsService, mockService);
    controller = module.get(IncidentsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'inc-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
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
});
