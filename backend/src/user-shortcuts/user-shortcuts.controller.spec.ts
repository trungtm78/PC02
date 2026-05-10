import { Test, TestingModule } from '@nestjs/testing';
import { UserShortcutsController } from './user-shortcuts.controller';
import { UserShortcutsService } from './user-shortcuts.service';

const mockService = {
  list: jest.fn(),
  upsert: jest.fn(),
  remove: jest.fn(),
  resetAll: jest.fn(),
  swap: jest.fn(),
};

const mockReq = { user: { id: 'u1' } };

describe('UserShortcutsController', () => {
  let controller: UserShortcutsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserShortcutsController],
      providers: [{ provide: UserShortcutsService, useValue: mockService }],
    }).compile();
    controller = module.get<UserShortcutsController>(UserShortcutsController);
  });

  it('list() delegates to service with req.user.id', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(mockReq);
    expect(mockService.list).toHaveBeenCalledWith('u1');
  });

  it('upsert() forwards userId, action, dto', async () => {
    const dto = { binding: 'Ctrl+Shift+S' };
    mockService.upsert.mockResolvedValue({ id: '1', action: 'save', binding: 'Ctrl+Shift+S' });
    await controller.upsert(mockReq, 'save', dto);
    expect(mockService.upsert).toHaveBeenCalledWith('u1', 'save', dto);
  });

  it('remove() forwards userId + action', async () => {
    mockService.remove.mockResolvedValue({ id: '1' });
    await controller.remove(mockReq, 'save');
    expect(mockService.remove).toHaveBeenCalledWith('u1', 'save');
  });

  it('resetAll() forwards userId', async () => {
    mockService.resetAll.mockResolvedValue({ deleted: 3 });
    await controller.resetAll(mockReq);
    expect(mockService.resetAll).toHaveBeenCalledWith('u1');
  });

  it('swap() forwards userId + dto', async () => {
    const dto = { fromAction: 'save', toAction: 'search' };
    mockService.swap.mockResolvedValue({ success: true, from: {}, to: {} });
    await controller.swap(mockReq, dto);
    expect(mockService.swap).toHaveBeenCalledWith('u1', dto);
  });
});
