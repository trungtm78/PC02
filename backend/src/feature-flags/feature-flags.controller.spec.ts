import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';

const mockService = {
  listAll: jest.fn(),
};

describe('FeatureFlagsController — delegation', () => {
  let controller: FeatureFlagsController;

  beforeEach(async () => {
    const module = await buildControllerModule(FeatureFlagsController, FeatureFlagsService, mockService);
    controller = module.get(FeatureFlagsController);
    jest.clearAllMocks();
  });

  it('list() delegates to service.listAll', async () => {
    mockService.listAll.mockResolvedValue([{ key: 'FEATURE_A', enabled: true }]);
    const result = await controller.list();
    expect(mockService.listAll).toHaveBeenCalled();
    expect(result).toEqual([{ key: 'FEATURE_A', enabled: true }]);
  });
});
