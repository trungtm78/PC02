import {
  buildControllerModule,
  makeReq,
  mockUser,
} from '../test-utils/controller-test-helpers';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

const mockService = {
  listAll: jest.fn(),
  setEnabled: jest.fn(),
  forceRefresh: jest.fn(),
};

describe('FeatureFlagsController — delegation', () => {
  let controller: FeatureFlagsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      FeatureFlagsController,
      FeatureFlagsService,
      mockService,
    );
    controller = module.get(FeatureFlagsController);
    jest.clearAllMocks();
  });

  it('update() passes the actor and request metadata to the service', async () => {
    mockService.setEnabled.mockResolvedValue({ key: 'kpi', enabled: false });
    const req = makeReq();

    await controller.update('kpi', { enabled: false }, mockUser, req);

    expect(mockService.setEnabled).toHaveBeenCalledWith('kpi', false, {
      id: mockUser.id,
      ipAddress: '127.0.0.1',
      userAgent: 'jest-test',
    });
  });

  it('refresh() re-reads the table and returns the current set', async () => {
    mockService.forceRefresh.mockResolvedValue(undefined);
    mockService.listAll.mockResolvedValue([{ key: 'kpi', enabled: true }]);

    const result = await controller.refresh();

    expect(mockService.forceRefresh).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: [{ key: 'kpi', enabled: true }],
    });
  });

  it('list() delegates to service.listAll', async () => {
    mockService.listAll.mockResolvedValue([
      { key: 'FEATURE_A', enabled: true },
    ]);
    const result = await controller.list();
    expect(mockService.listAll).toHaveBeenCalled();
    expect(result).toEqual([{ key: 'FEATURE_A', enabled: true }]);
  });
});

/**
 * The bug this guards against has a name and a history: putting the
 * permission on the class instead of the route. `GET /feature-flags` is what
 * every authenticated user calls on page load to build the sidebar, so a
 * class-level `@RequirePermissions` empties the menu for anyone lacking it —
 * and an empty sidebar reads as "the system is broken", not as "you lack a
 * permission".
 */
describe('FeatureFlagsController — route metadata', () => {
  /** Metadata on a route handler, looked up by name to keep `this` out of it. */
  const permsOn = (method: string): unknown =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      Object.getOwnPropertyDescriptor(FeatureFlagsController.prototype, method)
        ?.value,
    );

  it('does not require a permission to READ the flags', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, FeatureFlagsController),
    ).toBeUndefined();
    expect(permsOn('list')).toBeUndefined();
  });

  it.each(['update', 'refresh'])(
    'requires write:FeatureFlag on %s',
    (method) => {
      expect(permsOn(method)).toEqual([
        { action: 'write', subject: 'FeatureFlag' },
      ]);
    },
  );
});
