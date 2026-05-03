import { Test, TestingModule } from '@nestjs/testing';
import { PhuLuc16Controller } from './phu-luc-1-6.controller';
import { PhuLuc16Service } from './phu-luc-1-6.service';
import { PhuLuc16ExportService } from './phu-luc-1-6-export.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

const mockService = {
  getForLoai: jest.fn(),
};

const mockExportService = {
  export: jest.fn(),
};

describe('PhuLuc16Controller — delegation', () => {
  let controller: PhuLuc16Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhuLuc16Controller],
      providers: [
        { provide: PhuLuc16Service, useValue: mockService },
        { provide: PhuLuc16ExportService, useValue: mockExportService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<PhuLuc16Controller>(PhuLuc16Controller);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('preview() delegates to phuLuc16Service.getForLoai', async () => {
    mockService.getForLoai.mockResolvedValue({ data: [], total: 0 });
    const mockReq = { user: { id: 'u1' } } as any;
    await controller.preview({ loai: 1, fromDate: '2026-01-01', toDate: '2026-12-31' } as any, mockReq);
    expect(mockService.getForLoai).toHaveBeenCalledWith(1, expect.objectContaining({ loai: 1 }));
  });

  it('export() delegates to both services', async () => {
    mockService.getForLoai.mockResolvedValue({ data: [{ id: 'r1' }], total: 1 });
    mockExportService.export.mockResolvedValue(undefined);
    const mockReq = { user: { id: 'u1' } } as any;
    const mockRes = { setHeader: jest.fn(), end: jest.fn() } as any;
    await controller.export({ loai: 1, fromDate: '2026-01-01', toDate: '2026-12-31' } as any, mockReq, mockRes);
    expect(mockService.getForLoai).toHaveBeenCalledWith(1, expect.objectContaining({ loai: 1 }));
    expect(mockExportService.export).toHaveBeenCalledWith(1, [{ id: 'r1' }], mockRes);
  });
});
