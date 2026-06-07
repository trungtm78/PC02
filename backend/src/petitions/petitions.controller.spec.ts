import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { PetitionsController } from './petitions.controller';
import { PetitionsService } from './petitions.service';
import { PetitionsJourneyService } from './petitions-journey.service';

const mockService = {
  getList: jest.fn(),
  exportToExcel: jest.fn(),
  exportWardPetitions: jest.fn(),
  getById: jest.fn(),
  exportToWord: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  convertToIncident: jest.fn(),
  convertToCase: jest.fn(),
  assignPetition: jest.fn(),
  suspectSearch: jest.fn(),
  duplicateSearch: jest.fn(),
};

const mockJourneyService = { getJourney: jest.fn() };
const mockBatchExport = { exportBatchToZip: jest.fn() };

describe('PetitionsController — delegation', () => {
  let controller: PetitionsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      PetitionsController,
      PetitionsService,
      mockService,
      [
        { token: PetitionsJourneyService, mock: mockJourneyService },
        {
          token: require('./batch-export.service').BatchExportService,
          mock: mockBatchExport,
        },
      ],
    );
    controller = module.get(PetitionsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'pet-1' } });
    const req = makeReq();
    await controller.create({} as any, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      expect.anything(), // v0.33: dataScope param
    );
  });

  it('assignPetition() delegates to service.assignPetition', async () => {
    mockService.assignPetition.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignPetition('pet-1', { officerId: 'off-1' } as any, mockUser, req);
    expect(mockService.assignPetition).toHaveBeenCalledWith(
      'pet-1',
      { officerId: 'off-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
  });

  it('C1: exportWardPetitions() delegates to service.exportWardPetitions with query, dataScope, res, actor', async () => {
    mockService.exportWardPetitions.mockResolvedValue(undefined);
    const req = makeReq();
    const res = { setHeader: jest.fn() } as any;
    await (controller as any).exportWardPetitions(
      { unitId: 'u1', fromDate: '2026-01-01', toDate: '2026-03-31' },
      req,
      res,
    );
    expect(mockService.exportWardPetitions).toHaveBeenCalledWith(
      { unitId: 'u1', fromDate: '2026-01-01', toDate: '2026-03-31' },
      req.dataScope,
      res,
      expect.objectContaining({ userId: mockUser.id }),
    );
  });

  it('C2: PetitionsController has exportWardPetitions handler decorated with read permission', () => {
    // Reflective check — Nest stores metadata via @RequirePermissions on the method.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PERMISSIONS_KEY } = require('../auth/decorators/permissions.decorator');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Reflector } = require('@nestjs/core');
    const reflector = new Reflector();
    const handler = (PetitionsController.prototype as any).exportWardPetitions;
    expect(handler).toBeDefined();
    const perms = reflector.get(PERMISSIONS_KEY, handler);
    expect(perms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'read', subject: 'Petition' }),
      ]),
    );
  });

  it('convertToIncident() delegates to service.convertToIncident', async () => {
    mockService.convertToIncident.mockResolvedValue({ data: { id: 'inc-1' } });
    const req = makeReq();
    await controller.convertToIncident('pet-1', {} as any, mockUser, req);
    expect(mockService.convertToIncident).toHaveBeenCalledWith(
      'pet-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  // ── Nhóm V — suspect-search + duplicate-search ────────────────────────────

  it('V1: suspectSearch() delegates to service.suspectSearch with q param', async () => {
    mockService.suspectSearch.mockResolvedValue([]);
    const req = makeReq();
    await (controller as any).suspectSearch({ q: 'nguyen van a' }, req);
    expect(mockService.suspectSearch).toHaveBeenCalledWith('nguyen van a', req.dataScope);
  });

  it('V2: duplicateSearch() delegates to service.duplicateSearch with q and excludeId', async () => {
    mockService.duplicateSearch.mockResolvedValue([]);
    const req = makeReq();
    await (controller as any).duplicateSearch({ q: 'tham nhung', excludeId: 'pet-1' }, req);
    expect(mockService.duplicateSearch).toHaveBeenCalledWith('tham nhung', 'pet-1', req.dataScope);
  });

  it('V3: suspectSearch() returns empty array for empty q', async () => {
    mockService.suspectSearch.mockResolvedValue([]);
    const req = makeReq();
    await (controller as any).suspectSearch({ q: '' }, req);
    expect(mockService.suspectSearch).toHaveBeenCalledWith('', req.dataScope);
  });
});
