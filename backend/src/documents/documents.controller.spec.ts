import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getDownloadInfo: jest.fn(),
};

describe('DocumentsController — delegation', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(DocumentsController, DocumentsService, mockService);
    controller = module.get(DocumentsController);
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
    await controller.getById('doc-1', req);
    expect(mockService.getById).toHaveBeenCalledWith('doc-1', req.dataScope);
  });

  it('update() delegates to service.update with id, dto, userId and audit info', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    const req = makeReq();
    await controller.update('doc-1', {} as any, mockUser, req);
    expect(mockService.update).toHaveBeenCalledWith(
      'doc-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('delete() delegates to service.delete with id, userId, audit, dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('doc-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'doc-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });
});
