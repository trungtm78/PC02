import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

const mockService = {
  findAll: jest.fn(),
};

describe('AuditController — delegation', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module = await buildControllerModule(AuditController, AuditService, mockService);
    controller = module.get(AuditController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAll with parsed params', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll('CREATE', 'u1', 's1', 'Case', '10', '0');
    expect(mockService.findAll).toHaveBeenCalledWith({
      action: 'CREATE',
      userId: 'u1',
      subjectId: 's1',
      subject: 'Case',
      limit: 10,
      offset: 0,
    });
  });

  it('findAll() uses default limit/offset when not provided', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
  });
});
