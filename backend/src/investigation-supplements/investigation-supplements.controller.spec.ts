import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { InvestigationSupplementsController } from './investigation-supplements.controller';
import { InvestigationSupplementsService } from './investigation-supplements.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

describe('InvestigationSupplementsController — delegation', () => {
  let controller: InvestigationSupplementsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      InvestigationSupplementsController,
      InvestigationSupplementsService,
      mockService,
    );
    controller = module.get(InvestigationSupplementsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'is-1' } });
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
    await controller.delete('is-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'is-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });
});
