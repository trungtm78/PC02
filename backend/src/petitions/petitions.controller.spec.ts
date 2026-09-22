import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { PetitionsController } from './petitions.controller';
import { PetitionsService } from './petitions.service';
import { PetitionsJourneyService } from './petitions-journey.service';

const mockService = {
  xuatDanhSach: jest.fn(),
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
  goiYTenNguoiGui: jest.fn(),
  listAssignments: jest.fn(),
  addAssignment: jest.fn(),
  removeAssignment: jest.fn(),
  loadPetitionForExport: jest.fn(),
};

const mockJourneyService = { getJourney: jest.fn() };
const mockDynamicExport = {
  listExportableTemplates: jest.fn(),
  getExportReadiness: jest.fn(),
  exportEntityDocuments: jest.fn(),
};

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
          token: require('../document-templates/dynamic-export.service').DynamicExportService,
          mock: mockDynamicExport,
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

  describe('In chứng từ ĐỘNG (PR3)', () => {
    it('listDynamicExportTemplates() → dynamicExport.listExportableTemplates(DON_THU)', () => {
      controller.listDynamicExportTemplates();
      expect(mockDynamicExport.listExportableTemplates).toHaveBeenCalledWith('DON_THU');
    });

    it('dynamicExportReadiness() load petition rồi getExportReadiness(DON_THU, record)', async () => {
      const req = makeReq();
      const petition = { id: 'p1' };
      mockService.loadPetitionForExport.mockResolvedValue(petition);
      await controller.dynamicExportReadiness('p1', req);
      expect(mockService.loadPetitionForExport).toHaveBeenCalledWith('p1', req.dataScope);
      expect(mockDynamicExport.getExportReadiness).toHaveBeenCalledWith('DON_THU', petition);
    });

    it('dynamicExportDocuments() load petition rồi exportEntityDocuments(DON_THU, ...)', async () => {
      const req = makeReq();
      const petition = { id: 'p1' };
      mockService.loadPetitionForExport.mockResolvedValue(petition);
      const res = {} as any;
      const dto = { templateIds: ['t1'], mode: 'zip' as const, manualValues: { x: '1' } };
      await controller.dynamicExportDocuments('p1', dto as any, req, res, mockUser as any);
      expect(mockDynamicExport.exportEntityDocuments).toHaveBeenCalledWith(
        'DON_THU', 'p1', petition, ['t1'], 'zip', expect.any(String), { x: '1' }, res,
      );
    });
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

  // ── Nhóm I — PetitionAssignment CRUD ─────────────────────────────────────

  it('I-C1: listAssignments() delegates to service.listAssignments', async () => {
    mockService.listAssignments.mockResolvedValue([]);
    const req = makeReq();
    await (controller as any).listAssignments('petition-001', req);
    expect(mockService.listAssignments).toHaveBeenCalledWith('petition-001', req.dataScope);
  });

  it('I-C2: addAssignment() delegates to service.addAssignment with correct args', async () => {
    mockService.addAssignment.mockResolvedValue({ id: 'pa-001' });
    const req = makeReq();
    await (controller as any).addAssignment('petition-001', { userId: 'user-001', role: 'LEAD' }, mockUser, req);
    expect(mockService.addAssignment).toHaveBeenCalledWith('petition-001', 'user-001', 'LEAD', mockUser.id, req.dataScope);
  });

  it('I-C3: removeAssignment() delegates to service.removeAssignment', async () => {
    mockService.removeAssignment.mockResolvedValue({ success: true });
    // Phạm vi dữ liệu PHẢI xuống service — trước 19/09/2026 không chuyển, service không kiểm được gì.
    const nguoi = mockUser as AuthUser;
    const req = makeReq({
      dataScope: {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
        writableUserIds: ['u1'],
      },
    }) as ScopedRequest;
    await controller.removeAssignment('petition-001', 'user-001', nguoi, req);
    expect(mockService.removeAssignment).toHaveBeenCalledWith(
      'petition-001',
      'user-001',
      nguoi.id,
      req.dataScope,
    );
  });

  // Xuất Excel theo bộ lọc (18/09/2026): controller chuyển ĐÚNG bộ lọc, phạm vi dữ liệu và người xuất
  // (ghi nhật ký kiểm toán) xuống service.
  it('xuatDanhSach() chuyển bộ lọc + phạm vi + người xuất xuống service', async () => {
    mockService.xuatDanhSach.mockResolvedValue(undefined);
    const req = makeReq() as ScopedRequest;
    const nguoiXuat = mockUser as AuthUser;
    const res = { setHeader: jest.fn() } as never;
    const query = { cot: 'a,b', tk: ['x~y'] } as never;
    await controller.xuatDanhSach(query, nguoiXuat, req, res);
    expect(mockService.xuatDanhSach).toHaveBeenCalledWith(
      query,
      req.dataScope,
      res,
      {
        userId: nguoiXuat.id,
        ipAddress: '127.0.0.1',
        userAgent: 'jest-test',
      },
    );
  });
});

/**
 * Cổng phía SERVICE chứng minh phép lọc đúng, nhưng không thấy được chuyện controller quên
 * chuyển `req.dataScope` xuống. Bỏ tham số ấy đi là mọi ca kiểm service vẫn xanh trong khi gợi
 * ý trả tên của mọi tổ. Lượt soát mô hình ngoài 22/09/2026 chỉ đúng khe hở này.
 */
describe('PetitionsController — gợi ý tên người gửi chuyển ĐÚNG phạm vi dữ liệu', () => {
  let controller: PetitionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await buildControllerModule(
      PetitionsController,
      PetitionsService,
      mockService,
      [
        { token: PetitionsJourneyService, mock: mockJourneyService },
        {
          token: require('../document-templates/dynamic-export.service').DynamicExportService,
          mock: mockDynamicExport,
        },
      ],
    );
    controller = module.get(PetitionsController);
  });

  it('chuyển q VÀ req.dataScope xuống service', () => {
    const phamVi = {
      teamIds: ['to-a'],
      userIds: [],
      writableTeamIds: ['to-a'],
      writableUserIds: [],
    };
    const req = { ...makeReq(), dataScope: phamVi } as never;
    controller.goiYTenNguoiGui({ q: 'tran' }, req);
    expect(mockService.goiYTenNguoiGui).toHaveBeenCalledWith('tran', phamVi);
  });

  it('thiếu q → vẫn gọi với chuỗi rỗng, không ném', () => {
    const req = { ...makeReq(), dataScope: null } as never;
    controller.goiYTenNguoiGui({}, req);
    expect(mockService.goiYTenNguoiGui).toHaveBeenCalledWith('', null);
  });
});

