import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { AddressMappingController } from './address-mapping.controller';
import { AddressMappingService } from './address-mapping.service';

const mockService = {
  findAll: jest.fn(),
  lookup: jest.fn(),
  getStats: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  startSeedJob: jest.fn(),
  getSeedJobStatus: jest.fn(),
  cancelSeedJob: jest.fn(),
};

describe('AddressMappingController — delegation', () => {
  let controller: AddressMappingController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      AddressMappingController,
      AddressMappingService,
      mockService,
    );
    controller = module.get(AddressMappingController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAll', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
    await controller.findAll({} as any);
    expect(mockService.findAll).toHaveBeenCalledWith({});
  });

  it('lookup() delegates to service.lookup', async () => {
    const mapping = { oldWard: 'phường 14', oldDistrict: 'quận phú nhuận', newWard: 'phường phú nhuận' };
    mockService.lookup.mockResolvedValue(mapping);
    const result = await controller.lookup({ ward: 'phường 14', district: 'quận phú nhuận' } as any);
    expect(mockService.lookup).toHaveBeenCalled();
    expect(result).toEqual(mapping);
  });

  it('getStats() delegates to service.getStats', async () => {
    const stats = { total: 273, needsReview: 136, active: 273 };
    mockService.getStats.mockResolvedValue(stats);
    const result = await controller.getStats();
    expect(mockService.getStats).toHaveBeenCalled();
    expect(result).toEqual(stats);
  });

  it('create() delegates to service.create with dto', async () => {
    const dto = { oldWard: 'phường 14', oldDistrict: 'quận phú nhuận', newWard: 'phường phú nhuận', province: 'HCM' };
    mockService.create.mockResolvedValue({ id: 'm1', ...dto });
    await controller.create(dto as any);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update() delegates to service.update with id and dto', async () => {
    mockService.update.mockResolvedValue({ id: 'm1', needsReview: true });
    await controller.update('m1', { needsReview: true } as any);
    expect(mockService.update).toHaveBeenCalledWith('m1', { needsReview: true });
  });

  it('remove() delegates to service.remove with id', async () => {
    mockService.remove.mockResolvedValue({ message: 'Đã xóa mapping #m1' });
    await controller.remove('m1');
    expect(mockService.remove).toHaveBeenCalledWith('m1');
  });

  it('startSeed() uppercases province + passes user id to service', async () => {
    mockService.startSeedJob.mockResolvedValue({ jobId: 'job1', statusUrl: '/x' });
    const req = { user: { id: 'admin-001' } };
    await controller.startSeed('hcm', req as any);
    expect(mockService.startSeedJob).toHaveBeenCalledWith('HCM', 'admin-001');
  });

  it('seedStatus() delegates to service.getSeedJobStatus', async () => {
    mockService.getSeedJobStatus.mockResolvedValue({ id: 'job1', status: 'running' });
    await controller.seedStatus('job1');
    expect(mockService.getSeedJobStatus).toHaveBeenCalledWith('job1');
  });

  it('cancelSeed() delegates to service.cancelSeedJob', async () => {
    mockService.cancelSeedJob.mockResolvedValue({ ok: true });
    await controller.cancelSeed('job1');
    expect(mockService.cancelSeedJob).toHaveBeenCalledWith('job1');
  });
});
