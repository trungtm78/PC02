import { Test } from '@nestjs/testing';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';

const FAKE_SCOPE = { userIds: ['u1'], teamIds: ['t1'] };

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  getMessages: jest.fn(),
  create: jest.fn(),
  addMessage: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

function makeReq(dataScope: unknown = null) {
  return { dataScope, ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
}

describe('ExchangesController — dataScope wiring', () => {
  let controller: ExchangesController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExchangesController],
      providers: [{ provide: ExchangesService, useValue: mockService }],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ExchangesController);
    jest.clearAllMocks();
  });

  it('getList forwards dataScope to service', () => {
    mockService.getList.mockResolvedValue({ success: true, data: [] });
    controller.getList({} as any, makeReq(FAKE_SCOPE));
    expect(mockService.getList).toHaveBeenCalledWith({}, FAKE_SCOPE);
  });

  it('getById forwards dataScope to service', () => {
    mockService.getById.mockResolvedValue({ success: true, data: {} });
    controller.getById('ex-1', makeReq(FAKE_SCOPE));
    expect(mockService.getById).toHaveBeenCalledWith('ex-1', FAKE_SCOPE);
  });

  it('getMessages forwards dataScope to service', () => {
    mockService.getMessages.mockResolvedValue({ success: true, data: [] });
    controller.getMessages('ex-1', makeReq(FAKE_SCOPE));
    expect(mockService.getMessages).toHaveBeenCalledWith('ex-1', FAKE_SCOPE);
  });

  it('getList forwards null dataScope (admin) to service', () => {
    mockService.getList.mockResolvedValue({ success: true, data: [] });
    controller.getList({} as any, makeReq(null));
    expect(mockService.getList).toHaveBeenCalledWith({}, null);
  });
});
