import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
};

describe('TeamsController — delegation', () => {
  let controller: TeamsController;

  beforeEach(async () => {
    const module = await buildControllerModule(TeamsController, TeamsService, mockService);
    controller = module.get(TeamsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    await controller.getList();
    expect(mockService.getList).toHaveBeenCalled();
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'team-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('addMember() delegates to service.addMember with teamId, userId, requesterId', async () => {
    mockService.addMember.mockResolvedValue({ success: true });
    await controller.addMember('team-1', 'member-1', mockUser);
    expect(mockService.addMember).toHaveBeenCalledWith('team-1', 'member-1', mockUser.id);
  });

  it('removeMember() delegates to service.removeMember with teamId, memberId, requesterId', async () => {
    mockService.removeMember.mockResolvedValue({ success: true });
    await controller.removeMember('team-1', 'member-1', mockUser);
    expect(mockService.removeMember).toHaveBeenCalledWith('team-1', 'member-1', mockUser.id);
  });
});
