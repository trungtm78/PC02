import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  distinctActions: jest.fn(),
  distinctSubjects: jest.fn(),
  log: jest.fn().mockResolvedValue(undefined),
};

describe('AuditController — delegation', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module = await buildControllerModule(AuditController, AuditService, mockService);
    controller = module.get(AuditController);
    jest.clearAllMocks();
  });

  // v0.29: findAll accepts QueryAuditLogsDto (DTO with class-validator clamps)
  it('findAll() delegates to service with DTO params', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({
      action: 'CREATE',
      userId: 'u1',
      subjectId: 's1',
      subject: 'Case',
      limit: 10,
      offset: 0,
    });
    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        userId: 'u1',
        subjectId: 's1',
        subject: 'Case',
        limit: 10,
        offset: 0,
      }),
    );
  });

  it('findAll() with empty DTO uses defaults', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({});
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('actions() delegates to service.distinctActions', async () => {
    mockService.distinctActions.mockResolvedValue(['USER_CREATED', 'CASE_CREATED']);
    const result = await controller.actions();
    expect(result).toEqual(['USER_CREATED', 'CASE_CREATED']);
  });

  it('subjects() delegates to service.distinctSubjects', async () => {
    mockService.distinctSubjects.mockResolvedValue(['User', 'Case']);
    const result = await controller.subjects();
    expect(result).toEqual(['User', 'Case']);
  });
});
