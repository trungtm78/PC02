import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  getStatusHistory: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  tdcBackfill: jest.fn(),
  assignCase: jest.fn(),
};

describe('CasesController — delegation', () => {
  let controller: CasesController;

  beforeEach(async () => {
    const module = await buildControllerModule(CasesController, CasesService, mockService);
    controller = module.get(CasesController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'c1' } });
    const req = makeReq();
    await controller.create({ tenVuAn: 'Test' } as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      { tenVuAn: 'Test' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
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
