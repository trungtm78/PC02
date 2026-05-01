import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('SubjectsController — delegation', () => {
  let controller: SubjectsController;

  beforeEach(async () => {
    const module = await buildControllerModule(SubjectsController, SubjectsService, mockService);
    controller = module.get(SubjectsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'sub-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('update() delegates to service.update with id, dto, userId, audit, dataScope', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    const req = makeReq();
    await controller.update('sub-1', {} as any, mockUser, req);
    expect(mockService.update).toHaveBeenCalledWith(
      'sub-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('delete() delegates to service.delete with id, userId, audit, dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('sub-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'sub-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });
});
