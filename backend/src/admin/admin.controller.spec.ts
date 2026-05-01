import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const mockService = {
  getUsers: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  getRoles: jest.fn(),
  getRoleById: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  getAllPermissions: jest.fn(),
  updateRolePermissions: jest.fn(),
  listDataAccessGrants: jest.fn(),
  createDataAccessGrant: jest.fn(),
  revokeDataAccessGrant: jest.fn(),
  adminResetTwoFa: jest.fn(),
};

describe('AdminController — delegation', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module = await buildControllerModule(AdminController, AdminService, mockService);
    controller = module.get(AdminController);
    jest.clearAllMocks();
  });

  it('getUsers() delegates to service.getUsers', async () => {
    mockService.getUsers.mockResolvedValue({ data: [] });
    await controller.getUsers({} as any);
    expect(mockService.getUsers).toHaveBeenCalled();
  });

  it('createUser() delegates to service.createUser with userId and audit info', async () => {
    mockService.createUser.mockResolvedValue({ data: { id: 'u1' } });
    await controller.createUser({} as any, mockUser, makeReq());
    expect(mockService.createUser).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('updateRolePermissions() delegates to service.updateRolePermissions', async () => {
    mockService.updateRolePermissions.mockResolvedValue({ success: true });
    await controller.updateRolePermissions('role-1', {} as any, mockUser, makeReq());
    expect(mockService.updateRolePermissions).toHaveBeenCalledWith(
      'role-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('resetUserTwoFa() delegates to service.adminResetTwoFa', async () => {
    mockService.adminResetTwoFa.mockResolvedValue({ success: true });
    await controller.resetUserTwoFa('user-2', mockUser);
    expect(mockService.adminResetTwoFa).toHaveBeenCalledWith('user-2', mockUser.id);
  });
});
