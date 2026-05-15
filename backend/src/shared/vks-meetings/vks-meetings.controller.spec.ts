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

const mockReq = { dataScope: null } as any;

describe('CaseVksMeetingsController — delegation', () => {
  let controller: CaseVksMeetingsController;

  beforeEach(async () => {
    const module = await buildControllerModule(CaseVksMeetingsController, VksMeetingsService, mockService);
    controller = module.get(CaseVksMeetingsController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForCase with caseId + dataScope', async () => {
    mockService.findAllForCase.mockResolvedValue({ data: [] });
    await controller.findAll('case-1', mockReq);
    expect(mockService.findAllForCase).toHaveBeenCalledWith('case-1', null);
  });

  it('create() delegates to service.createForCase with caseId, dto, userId, dataScope', async () => {
    mockService.createForCase.mockResolvedValue({ data: { id: 'vm-1' } });
    await controller.create('case-1', {} as any, mockUser, mockReq);
    expect(mockService.createForCase).toHaveBeenCalledWith('case-1', {}, mockUser.id, null);
  });

  it('delete() delegates to service.delete with id + dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    await controller.delete('vm-1', mockReq);
    expect(mockService.delete).toHaveBeenCalledWith('vm-1', null);
  });
});

describe('IncidentVksMeetingsController — delegation', () => {
  let controller: IncidentVksMeetingsController;

  beforeEach(async () => {
    const module = await buildControllerModule(IncidentVksMeetingsController, VksMeetingsService, mockService);
    controller = module.get(IncidentVksMeetingsController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForIncident with incidentId + dataScope', async () => {
    mockService.findAllForIncident.mockResolvedValue({ data: [] });
    await controller.findAll('inc-1', mockReq);
    expect(mockService.findAllForIncident).toHaveBeenCalledWith('inc-1', null);
  });

  it('create() delegates to service.createForIncident with incidentId, dto, userId, dataScope', async () => {
    mockService.createForIncident.mockResolvedValue({ data: { id: 'vm-2' } });
    await controller.create('inc-1', {} as any, mockUser, mockReq);
    expect(mockService.createForIncident).toHaveBeenCalledWith('inc-1', {}, mockUser.id, null);
  });
});
