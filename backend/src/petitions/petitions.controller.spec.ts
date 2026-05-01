import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { PetitionsController } from './petitions.controller';
import { PetitionsService } from './petitions.service';

const mockService = {
  getList: jest.fn(),
  exportToExcel: jest.fn(),
  getById: jest.fn(),
  exportToWord: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  convertToIncident: jest.fn(),
  convertToCase: jest.fn(),
  assignPetition: jest.fn(),
};

describe('PetitionsController — delegation', () => {
  let controller: PetitionsController;

  beforeEach(async () => {
    const module = await buildControllerModule(PetitionsController, PetitionsService, mockService);
    controller = module.get(PetitionsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'pet-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('assignPetition() delegates to service.assignPetition', async () => {
    mockService.assignPetition.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignPetition('pet-1', { officerId: 'off-1' } as any, mockUser, req);
    expect(mockService.assignPetition).toHaveBeenCalledWith(
      'pet-1',
      { officerId: 'off-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('convertToIncident() delegates to service.convertToIncident', async () => {
    mockService.convertToIncident.mockResolvedValue({ data: { id: 'inc-1' } });
    const req = makeReq();
    await controller.convertToIncident('pet-1', {} as any, mockUser, req);
    expect(mockService.convertToIncident).toHaveBeenCalledWith(
      'pet-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });
});
