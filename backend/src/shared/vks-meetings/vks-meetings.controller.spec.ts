import { buildControllerModule, mockUser } from '../../test-utils/controller-test-helpers';
import { CaseVksMeetingsController, IncidentVksMeetingsController } from './vks-meetings.controller';
import { VksMeetingsService } from './vks-meetings.service';

const mockService = {
  findAllForCase: jest.fn(),
  createForCase: jest.fn(),
  findAllForIncident: jest.fn(),
  createForIncident: jest.fn(),
  delete: jest.fn(),
};

describe('CaseVksMeetingsController — delegation', () => {
  let controller: CaseVksMeetingsController;

  beforeEach(async () => {
    const module = await buildControllerModule(CaseVksMeetingsController, VksMeetingsService, mockService);
    controller = module.get(CaseVksMeetingsController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForCase with caseId', async () => {
    mockService.findAllForCase.mockResolvedValue({ data: [] });
    await controller.findAll('case-1');
    expect(mockService.findAllForCase).toHaveBeenCalledWith('case-1');
  });

  it('create() delegates to service.createForCase with caseId, dto, userId', async () => {
    mockService.createForCase.mockResolvedValue({ data: { id: 'vm-1' } });
    await controller.create('case-1', {} as any, mockUser);
    expect(mockService.createForCase).toHaveBeenCalledWith('case-1', {}, mockUser.id);
  });

  it('delete() delegates to service.delete with id', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    await controller.delete('vm-1');
    expect(mockService.delete).toHaveBeenCalledWith('vm-1');
  });
});

describe('IncidentVksMeetingsController — delegation', () => {
  let controller: IncidentVksMeetingsController;

  beforeEach(async () => {
    const module = await buildControllerModule(IncidentVksMeetingsController, VksMeetingsService, mockService);
    controller = module.get(IncidentVksMeetingsController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForIncident with incidentId', async () => {
    mockService.findAllForIncident.mockResolvedValue({ data: [] });
    await controller.findAll('inc-1');
    expect(mockService.findAllForIncident).toHaveBeenCalledWith('inc-1');
  });

  it('create() delegates to service.createForIncident with incidentId, dto, userId', async () => {
    mockService.createForIncident.mockResolvedValue({ data: { id: 'vm-2' } });
    await controller.create('inc-1', {} as any, mockUser);
    expect(mockService.createForIncident).toHaveBeenCalledWith('inc-1', {}, mockUser.id);
  });
});
