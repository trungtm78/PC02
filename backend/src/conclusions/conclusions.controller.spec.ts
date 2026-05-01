import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { ConclusionsController } from './conclusions.controller';
import { ConclusionsService } from './conclusions.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ConclusionsController — delegation', () => {
  let controller: ConclusionsController;

  beforeEach(async () => {
    const module = await buildControllerModule(ConclusionsController, ConclusionsService, mockService);
    controller = module.get(ConclusionsController);
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
    await controller.getById('con-1', req);
    expect(mockService.getById).toHaveBeenCalledWith('con-1', req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'con-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('delete() delegates to service.delete with id, userId, audit, dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('con-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'con-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });
});
