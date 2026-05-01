import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { MasterClassController } from './master-class.controller';
import { MasterClassService } from './master-class.service';

const mockService = {
  getTypes: jest.fn(),
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('MasterClassController — delegation', () => {
  let controller: MasterClassController;

  beforeEach(async () => {
    const module = await buildControllerModule(MasterClassController, MasterClassService, mockService);
    controller = module.get(MasterClassController);
    jest.clearAllMocks();
  });

  it('getTypes() delegates to service.getTypes', async () => {
    mockService.getTypes.mockResolvedValue({ data: [] });
    await controller.getTypes();
    expect(mockService.getTypes).toHaveBeenCalled();
  });

  it('getList() delegates to service.getList with query', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    await controller.getList({} as any);
    expect(mockService.getList).toHaveBeenCalledWith({});
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'mc-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('delete() delegates to service.delete with id, userId and audit info', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('mc-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'mc-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });
});
