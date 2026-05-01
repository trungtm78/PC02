import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { GuidanceController } from './guidance.controller';
import { GuidanceService } from './guidance.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('GuidanceController — delegation', () => {
  let controller: GuidanceController;

  beforeEach(async () => {
    const module = await buildControllerModule(GuidanceController, GuidanceService, mockService);
    controller = module.get(GuidanceController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getById() delegates to service.getById with id and dataScope', async () => {
    mockService.getById.mockResolvedValue({ data: {} });
    const req = makeReq();
    await controller.getById('g-1', req);
    expect(mockService.getById).toHaveBeenCalledWith('g-1', req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'g-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });
});
