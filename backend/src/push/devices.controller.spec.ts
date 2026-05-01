import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

const mockService = {
  register: jest.fn(),
  unregister: jest.fn(),
};

describe('DevicesController — delegation', () => {
  let controller: DevicesController;

  beforeEach(async () => {
    const module = await buildControllerModule(DevicesController, DevicesService, mockService);
    controller = module.get(DevicesController);
    jest.clearAllMocks();
  });

  it('register() delegates to service.register with userId, fcmToken and platform', async () => {
    mockService.register.mockResolvedValue({ success: true });
    const req = { user: { id: 'user-001' } } as any;
    await controller.register(req, { fcmToken: 'tok-123', platform: 'android' } as any);
    expect(mockService.register).toHaveBeenCalledWith('user-001', 'tok-123', 'android');
  });

  it('unregister() delegates to service.unregister with token and userId', async () => {
    mockService.unregister.mockResolvedValue({ success: true });
    const req = { user: { id: 'user-001' } } as any;
    await controller.unregister(req, 'tok-123');
    expect(mockService.unregister).toHaveBeenCalledWith('tok-123', 'user-001');
  });
});
