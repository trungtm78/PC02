import { Test, TestingModule } from '@nestjs/testing';
import { AbbreviationsController } from './abbreviations.controller';
import { AbbreviationsService } from './abbreviations.service';

const mockService = {
  list: jest.fn(),
  upsert: jest.fn(),
  remove: jest.fn(),
  copyFrom: jest.fn(),
  listUsers: jest.fn(),
};

const mockReq = { user: { id: 'u1' } };

describe('AbbreviationsController', () => {
  let controller: AbbreviationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbbreviationsController],
      providers: [{ provide: AbbreviationsService, useValue: mockService }],
    }).compile();
    controller = module.get<AbbreviationsController>(AbbreviationsController);
  });

  it('list() delegates to service.list with userId', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(mockReq);
    expect(mockService.list).toHaveBeenCalledWith('u1');
  });

  it('upsert() delegates to service.upsert with userId, shortcut, dto', async () => {
    const dto = { shortcut: 'lvs', expansion: 'Lê Văn Sỹ' };
    mockService.upsert.mockResolvedValue({ id: '1', ...dto });
    await controller.upsert(mockReq, 'lvs', dto);
    expect(mockService.upsert).toHaveBeenCalledWith('u1', 'lvs', dto);
  });

  it('remove() delegates to service.remove with userId, shortcut', async () => {
    mockService.remove.mockResolvedValue({ id: '1' });
    await controller.remove(mockReq, 'lvs');
    expect(mockService.remove).toHaveBeenCalledWith('u1', 'lvs');
  });

  it('copyFrom() delegates to service.copyFrom with userId, dto', async () => {
    const dto = { sourceUserId: 'u2', replace: false };
    mockService.copyFrom.mockResolvedValue({ copied: 3 });
    await controller.copyFrom(mockReq, dto);
    expect(mockService.copyFrom).toHaveBeenCalledWith('u1', dto);
  });

  it('listUsers() delegates to service.listUsers with userId', async () => {
    mockService.listUsers.mockResolvedValue([]);
    await controller.listUsers(mockReq);
    expect(mockService.listUsers).toHaveBeenCalledWith('u1');
  });
});
