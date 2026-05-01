import { buildControllerModule, mockUser } from '../test-utils/controller-test-helpers';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const mockService = {
  getList: jest.fn(),
  getUnreadCount: jest.fn(),
  seedDemoForUser: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteOne: jest.fn(),
  deleteAllRead: jest.fn(),
};

describe('NotificationsController — delegation', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module = await buildControllerModule(NotificationsController, NotificationsService, mockService);
    controller = module.get(NotificationsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with userId and query', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    await controller.getList(mockUser, {} as any);
    expect(mockService.getList).toHaveBeenCalledWith(mockUser.id, {});
  });

  it('getUnreadCount() delegates to service.getUnreadCount with userId', async () => {
    mockService.getUnreadCount.mockResolvedValue({ count: 3 });
    await controller.getUnreadCount(mockUser);
    expect(mockService.getUnreadCount).toHaveBeenCalledWith(mockUser.id);
  });

  it('markAsRead() delegates to service.markAsRead with id and userId', async () => {
    mockService.markAsRead.mockResolvedValue({ success: true });
    await controller.markAsRead('notif-1', mockUser);
    expect(mockService.markAsRead).toHaveBeenCalledWith('notif-1', mockUser.id);
  });

  it('markAllAsRead() delegates to service.markAllAsRead with userId', async () => {
    mockService.markAllAsRead.mockResolvedValue({ success: true });
    await controller.markAllAsRead(mockUser);
    expect(mockService.markAllAsRead).toHaveBeenCalledWith(mockUser.id);
  });
});
