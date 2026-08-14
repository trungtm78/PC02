import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

const mockService = {
  getAll: jest.fn(),
  getDeadlines: jest.fn(),
  updateValue: jest.fn(),
  seed: jest.fn(),
};

describe('SettingsController — delegation', () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      SettingsController,
      SettingsService,
      mockService,
    );
    controller = module.get(SettingsController);
    jest.clearAllMocks();
  });

  it('getAll() delegates to service.getAll', async () => {
    mockService.getAll.mockResolvedValue({ data: [] });
    await controller.getAll();
    expect(mockService.getAll).toHaveBeenCalled();
  });

  it('getDeadlines() delegates to service.getDeadlines', async () => {
    mockService.getDeadlines.mockResolvedValue({ data: {} });
    await controller.getDeadlines();
    expect(mockService.getDeadlines).toHaveBeenCalled();
  });

  it('updateValue() delegates to service.updateValue with key, value, userId, meta', async () => {
    mockService.updateValue.mockResolvedValue({ success: true });
    const mockReq = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      user: { sub: 'admin' },
    } as any;
    await controller.updateValue('DEADLINE_DAYS', '30', mockReq);
    expect(mockService.updateValue).toHaveBeenCalledWith(
      'DEADLINE_DAYS',
      '30',
      'admin',
      expect.objectContaining({ ipAddress: '127.0.0.1', userAgent: 'jest' }),
    );
  });

  it('seed() delegates to service.seed', async () => {
    mockService.seed.mockResolvedValue({ seeded: true });
    await controller.seed();
    expect(mockService.seed).toHaveBeenCalled();
  });
});
