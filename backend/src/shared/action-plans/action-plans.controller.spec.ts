import { buildControllerModule, mockUser } from '../../test-utils/controller-test-helpers';
import { CaseActionPlansController, IncidentActionPlansController } from './action-plans.controller';
import { ActionPlansService } from './action-plans.service';

const mockService = {
  findAllForCase: jest.fn(),
  createForCase: jest.fn(),
  findAllForIncident: jest.fn(),
  createForIncident: jest.fn(),
  delete: jest.fn(),
};

describe('CaseActionPlansController — delegation', () => {
  let controller: CaseActionPlansController;

  beforeEach(async () => {
    const module = await buildControllerModule(CaseActionPlansController, ActionPlansService, mockService);
    controller = module.get(CaseActionPlansController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForCase with caseId', async () => {
    mockService.findAllForCase.mockResolvedValue({ data: [] });
    await controller.findAll('case-1');
    expect(mockService.findAllForCase).toHaveBeenCalledWith('case-1');
  });

  it('create() delegates to service.createForCase with caseId, dto, userId', async () => {
    mockService.createForCase.mockResolvedValue({ data: { id: 'ap-1' } });
    await controller.create('case-1', {} as any, mockUser);
    expect(mockService.createForCase).toHaveBeenCalledWith('case-1', {}, mockUser.id);
  });

  it('delete() delegates to service.delete with id', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    await controller.delete('ap-1');
    expect(mockService.delete).toHaveBeenCalledWith('ap-1');
  });
});

describe('IncidentActionPlansController — delegation', () => {
  let controller: IncidentActionPlansController;

  beforeEach(async () => {
    const module = await buildControllerModule(IncidentActionPlansController, ActionPlansService, mockService);
    controller = module.get(IncidentActionPlansController);
    jest.clearAllMocks();
  });

  it('findAll() delegates to service.findAllForIncident with incidentId', async () => {
    mockService.findAllForIncident.mockResolvedValue({ data: [] });
    await controller.findAll('inc-1');
    expect(mockService.findAllForIncident).toHaveBeenCalledWith('inc-1');
  });

  it('create() delegates to service.createForIncident with incidentId, dto, userId', async () => {
    mockService.createForIncident.mockResolvedValue({ data: { id: 'ap-2' } });
    await controller.create('inc-1', {} as any, mockUser);
    expect(mockService.createForIncident).toHaveBeenCalledWith('inc-1', {}, mockUser.id);
  });
});
