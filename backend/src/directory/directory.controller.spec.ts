import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

const mockService = {
  findAll: jest.fn(),
  findTypes: jest.fn(),
  getTypeStats: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  seedSampleData: jest.fn(),
};

describe('DirectoryController — delegation', () => {
  let controller: DirectoryController;

  beforeEach(async () => {
    const module = await buildControllerModule(DirectoryController, DirectoryService, mockService);
    controller = module.get(DirectoryController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAll with query', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({} as any);
    expect(mockService.findAll).toHaveBeenCalledWith({});
  });

  it('findTypes() delegates to service.findTypes', async () => {
    mockService.findTypes.mockResolvedValue({ data: [] });
    await controller.findTypes();
    expect(mockService.findTypes).toHaveBeenCalled();
  });

  it('create() delegates to service.create with dto', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'dir-1' } });
    await controller.create({ name: 'Test' } as any);
    expect(mockService.create).toHaveBeenCalledWith({ name: 'Test' });
  });

  it('remove() delegates to service.remove with id', async () => {
    mockService.remove.mockResolvedValue({ success: true });
    await controller.remove('dir-1');
    expect(mockService.remove).toHaveBeenCalledWith('dir-1');
  });

  it('getStats() delegates to service.getTypeStats', async () => {
    const stats = [{ type: 'WARD', count: 10051 }, { type: 'PROVINCE', count: 34 }];
    mockService.getTypeStats.mockResolvedValue(stats);
    const result = await controller.getStats();
    expect(mockService.getTypeStats).toHaveBeenCalled();
    expect(result).toEqual(stats);
  });
});
