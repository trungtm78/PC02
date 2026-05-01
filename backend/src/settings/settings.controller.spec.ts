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
    const module = await buildControllerModule(SettingsController, SettingsService, mockService);
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

  it('updateValue() delegates to service.updateValue with key and value', async () => {
    mockService.updateValue.mockResolvedValue({ success: true });
    await controller.updateValue('DEADLINE_DAYS', '30');
    expect(mockService.updateValue).toHaveBeenCalledWith('DEADLINE_DAYS', '30');
  });

  it('seed() delegates to service.seed', async () => {
    mockService.seed.mockResolvedValue({ seeded: true });
    await controller.seed();
    expect(mockService.seed).toHaveBeenCalled();
  });
});
