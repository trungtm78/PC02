import {
  buildControllerModule,
  makeReq,
  mockUser,
} from '../test-utils/controller-test-helpers';
import type { Response } from 'express';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentsJourneyService } from './incidents-journey.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import type { ExportEntityDocumentsDto } from '../document-templates/dto/export-entity-documents.dto';
import type { QueryIncidentsDto } from './dto/query-incidents.dto';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import type { ReviewIncidentDuplicatesDto } from './dto/review-incident-duplicates.dto';
import type { UpdateStatusDto } from './dto/update-status.dto';
import type { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import type { ListLinkableIncidentDto } from './dto/list-linkable.dto';
import type { UpdateIncidentDto } from './dto/update-incident.dto';

const mockService = {
  xuatDanhSach: jest.fn(),
  xuatDayDu: jest.fn(),
  getList: jest.fn(),
  listLinkable: jest.fn(),
  getStats: jest.fn(),
  getInvestigators: jest.fn(),
  findReporterSuggestions: jest.fn(),
  findDuplicateCandidates: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateResult: jest.fn(),
  delete: jest.fn(),
  updateStatus: jest.fn(),
  mergeInto: jest.fn(),
  transferUnit: jest.fn(),
  assignInvestigator: jest.fn(),
  extendDeadline: jest.fn(),
  prosecute: jest.fn(),
};

const mockJourneyService = { getJourney: jest.fn() };
const mockDynamicExport = {
  exportEntityDocuments: jest.fn(),
  exportBatchByCodes: jest.fn(),
  listExportableTemplates: jest.fn(),
};

describe('IncidentsController — delegation', () => {
  let controller: IncidentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      IncidentsController,
      IncidentsService,
      mockService,
      [
        { token: IncidentsJourneyService, mock: mockJourneyService },
        { token: DynamicExportService, mock: mockDynamicExport },
      ],
    );
    controller = module.get(IncidentsController);
    jest.clearAllMocks();
  });

  it('exportDocuments() load incident (scope) rồi delegate dynamicExport (VU_VIEC)', async () => {
    const record = { id: 'i1', code: 'VV-1' };
    mockService.getById.mockResolvedValue({ success: true, data: record }); // getById wrap {success,data}
    const req = makeReq();
    const res = {
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    await controller.exportDocuments(
      'i1',
      { templateIds: ['t1'], mode: 'merged' } as ExportEntityDocumentsDto,
      req,
      res,
      mockUser,
    );
    expect(mockService.getById).toHaveBeenCalledWith('i1', req.dataScope);
    expect(mockDynamicExport.exportEntityDocuments).toHaveBeenCalledWith(
      'VU_VIEC',
      'i1',
      record,
      ['t1'],
      'merged',
      mockUser.id,
      {},
      res,
    );
  });

  it('exportDocumentBatch() re-checks every incident through the scoped loader', async () => {
    const req = makeReq();
    const res = {
      send: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    mockService.getById.mockResolvedValue({
      success: true,
      data: { id: 'i1' },
    });
    mockDynamicExport.exportBatchByCodes.mockImplementation(
      async (
        _entity: string,
        _codes: string[],
        ids: string[],
        load: (id: string) => Promise<unknown>,
      ) => {
        await Promise.all(ids.map(load));
      },
    );

    await controller.exportDocumentBatch(
      { incidentIds: ['i1', 'i2'], docTypes: ['BB01'] },
      mockUser,
      req,
      res,
    );

    expect(mockService.getById).toHaveBeenNthCalledWith(1, 'i1', req.dataScope);
    expect(mockService.getById).toHaveBeenNthCalledWith(2, 'i2', req.dataScope);
    expect(mockDynamicExport.exportBatchByCodes).toHaveBeenCalledWith(
      'VU_VIEC',
      ['BB01'],
      ['i1', 'i2'],
      expect.any(Function),
      mockUser.id,
      res,
    );
  });

  it('exportDocumentBatch() rejects more than 100 records', async () => {
    await expect(
      controller.exportDocumentBatch(
        {
          incidentIds: Array.from({ length: 101 }, (_, index) => `i${index}`),
          docTypes: ['BB01'],
        },
        mockUser,
        makeReq(),
        {} as never,
      ),
    ).rejects.toThrow('1 đến 100');
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as QueryIncidentsDto, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  it('listLinkable() keeps the query inside the request data scope', async () => {
    const query = { search: 'VV-26', limit: 10 } as ListLinkableIncidentDto;
    const req = makeReq();
    mockService.listLinkable.mockResolvedValue({ data: [] });

    await controller.listLinkable(query, req);

    expect(mockService.listLinkable).toHaveBeenCalledWith(query, req.dataScope);
  });

  it('getJourney() normalizes pagination before delegating with data scope', async () => {
    const req = makeReq();
    mockJourneyService.getJourney.mockResolvedValue({ data: [] });

    await controller.getJourney('inc-1', req, 0, 999);

    expect(mockJourneyService.getJourney).toHaveBeenCalledWith(
      'inc-1',
      req.dataScope,
      1,
      200,
    );
  });

  it('update() forwards the editable payload and audit context', async () => {
    const req = makeReq();
    const dto = { name: 'Tên đã sửa' } as UpdateIncidentDto;
    mockService.update.mockResolvedValue({ data: { id: 'inc-1' } });

    await controller.update('inc-1', dto, mockUser, req);

    expect(mockService.update).toHaveBeenCalledWith(
      'inc-1',
      dto,
      mockUser.id,
      expect.objectContaining({
        ipAddress: '127.0.0.1',
        userAgent: 'jest-test',
      }),
      req.dataScope,
    );
  });

  it('listExportTemplates() delegate dynamicExport (VU_VIEC) — quyền read Incident', async () => {
    const rows = [{ id: 't1', code: 'BB01' }];
    mockDynamicExport.listExportableTemplates.mockResolvedValue(rows);
    await expect(controller.listExportTemplates()).resolves.toBe(rows);
    expect(mockDynamicExport.listExportableTemplates).toHaveBeenCalledWith(
      'VU_VIEC',
    );
  });

  it('create() delegates to service.create with dto, userId and audit info', async () => {
    mockService.create.mockResolvedValue({ data: { id: 'inc-1' } });
    const req = makeReq();
    await controller.create({} as CreateIncidentDto, mockUser, req);
    expect(mockService.create).toHaveBeenCalledWith(
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      expect.anything(), // v0.33: dataScope param
      undefined,
    );
  });

  it('duplicateReview() accepts the request body so long content is not limited by the URL', async () => {
    const dto = {
      content: 'x'.repeat(20_000),
      phone: '0901234567',
    } as ReviewIncidentDuplicatesDto;
    const req = makeReq();
    mockService.findDuplicateCandidates.mockResolvedValue([]);

    await controller.duplicateReview(dto, req);

    expect(mockService.findDuplicateCandidates).toHaveBeenCalledWith(
      dto,
      undefined,
      req.dataScope,
    );
  });

  it('reporterSuggestions() delegates the normalized empty fallback with data scope', async () => {
    const req = makeReq();
    mockService.findReporterSuggestions.mockResolvedValue([]);

    await controller.reporterSuggestions(undefined as unknown as string, req);

    expect(mockService.findReporterSuggestions).toHaveBeenCalledWith(
      '',
      req.dataScope,
    );
  });

  it('updateStatus() delegates to service.updateStatus with id, dto, userId', async () => {
    mockService.updateStatus.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.updateStatus(
      'inc-1',
      { status: 'RESOLVED' } as unknown as UpdateStatusDto,
      mockUser,
      req,
    );
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      'inc-1',
      { status: 'RESOLVED' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('updateResult() delegates to the narrow result command', async () => {
    mockService.updateResult.mockResolvedValue({ success: true });
    const req = makeReq();
    const dto = {
      ketQuaXuLy: 'Đã xác minh',
      expectedUpdatedAt: '2026-09-01T00:00:00.000Z',
    };
    await controller.updateResult('inc-1', dto, mockUser, req);
    expect(mockService.updateResult).toHaveBeenCalledWith(
      'inc-1',
      dto,
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('assignInvestigator() delegates to service.assignInvestigator', async () => {
    mockService.assignInvestigator.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.assignInvestigator(
      'inc-1',
      { investigatorId: 'inv-1' } as AssignInvestigatorDto,
      mockUser,
      req,
    );
    expect(mockService.assignInvestigator).toHaveBeenCalledWith(
      'inc-1',
      { investigatorId: 'inv-1' },
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  // Xuất Excel theo bộ lọc (18/09/2026): controller chuyển ĐÚNG bộ lọc, phạm vi dữ liệu và người xuất
  // (ghi nhật ký kiểm toán) xuống service.
  it('xuatDanhSach() chuyển bộ lọc + phạm vi + người xuất xuống service', async () => {
    mockService.xuatDanhSach.mockResolvedValue(undefined);
    const req = makeReq();
    const nguoiXuat = mockUser;
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

  it('xuatDayDu() forwards the same scoped filters and audit actor', async () => {
    const req = makeReq();
    const res = { setHeader: jest.fn() } as never;
    const query = { tk: ['*~abc'] } as never;
    await controller.xuatDayDu(query, mockUser, req, res);
    expect(mockService.xuatDayDu).toHaveBeenCalledWith(
      query,
      req.dataScope,
      res,
      {
        userId: mockUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'jest-test',
      },
    );
  });
});
