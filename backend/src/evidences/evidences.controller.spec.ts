import {
  buildControllerModule,
  makeReq,
  mockUser,
} from '../test-utils/controller-test-helpers';
import { EvidencesController } from './evidences.controller';
import { EvidencesService } from './evidences.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  listDeleted: jest.fn(),
  restore: jest.fn(),
};

describe('EvidencesController — delegation', () => {
  let controller: EvidencesController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      EvidencesController,
      EvidencesService,
      mockService,
    );
    controller = module.get(EvidencesController);
    jest.clearAllMocks();
  });

  it('getList() passes the query and the request data scope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();

    await controller.getList({} as never, req);

    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('getById() passes the data scope', async () => {
    mockService.getById.mockResolvedValue({ data: {} });
    const req = makeReq();

    await controller.getById('ev-1', req);

    expect(mockService.getById).toHaveBeenCalledWith('ev-1', req.dataScope);
  });

  // Every mutation must forward the scope. The bug this module was written
  // against was POST /subjects accepting any caseId because the controller
  // never passed req.dataScope down.
  it('create() forwards actor, request metadata and data scope', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'ev-1' } });
    const req = makeReq();

    await controller.create({} as never, mockUser, req);

    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('update() forwards actor, request metadata and data scope', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    const req = makeReq();

    await controller.update('ev-1', {} as never, mockUser, req);

    expect(mockService.update).toHaveBeenCalledWith(
      'ev-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('delete() forwards actor, request metadata and data scope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();

    await controller.delete('ev-1', mockUser, req);

    expect(mockService.delete).toHaveBeenCalledWith(
      'ev-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('listDeleted() passes the query and the data scope', async () => {
    mockService.listDeleted.mockResolvedValue({ data: [] });
    const req = makeReq();

    await controller.listDeleted({ limit: 10 }, req);

    expect(mockService.listDeleted).toHaveBeenCalledWith(
      { limit: 10 },
      req.dataScope,
    );
  });

  it('restore() unwraps the reason from the body', async () => {
    mockService.restore.mockResolvedValue({ success: true });
    const req = makeReq();

    await controller.restore(
      'ev-1',
      { reason: 'Xóa nhầm khi nhập' },
      mockUser,
      req,
    );

    expect(mockService.restore).toHaveBeenCalledWith(
      'ev-1',
      'Xóa nhầm khi nhập',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('propagates service errors rather than swallowing them', async () => {
    mockService.getById.mockRejectedValue(new Error('boom'));

    await expect(controller.getById('ev-1', makeReq())).rejects.toThrow('boom');
  });
});
