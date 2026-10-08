import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

const actorRequest={user:{id:'audit-reader'},ip:'127.0.0.1',headers:{}} as never;
const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  distinctActions: jest.fn(),
  distinctSubjects: jest.fn(),
  log: jest.fn().mockResolvedValue(undefined),
};

describe('AuditController — delegation', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module = await buildControllerModule(AuditController, AuditService, mockService);
    controller = module.get(AuditController);
    jest.clearAllMocks();
  });

  // v0.29: findAll accepts QueryAuditLogsDto (DTO with class-validator clamps)
  it('findAll() delegates to service with DTO params', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({
      action: 'CREATE',
      userId: 'u1',
      subjectId: 's1',
      subject: 'Case',
      limit: 10,
      offset: 0,
    },actorRequest);
    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        userId: 'u1',
        subjectId: 's1',
        subject: 'Case',
        limit: 10,
        offset: 0,
      }),
      'audit-reader',
    );
  });

  it('findAll() with empty DTO uses defaults', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({},actorRequest);
    expect(mockService.findAll).toHaveBeenCalled();
  });

  /**
   * M6: thẻ tìm kiếm (`tk`) phải tới service ở CẢ danh sách lẫn xuất CSV — xuất mà bỏ thẻ là tệp
   * chứa bản ghi màn không hiện (khác thứ cán bộ vừa lọc).
   */
  it('findAll() chuyển thẻ `tk` xuống service', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    await controller.findAll({ tk: ['nguoiThucHien~an'] },actorRequest);
    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ tk: ['nguoiThucHien~an'] }),
      'audit-reader',
    );
  });

  it('exportCsv() áp cùng thẻ `tk` như danh sách', async () => {
    mockService.findAll.mockResolvedValue({ data: [] });
    const req = { user: { id: 'audit-reader' }, ip: '127.0.0.1', headers: {} };
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() };
    await controller.exportCsv(
      { tk: ['thaoTac~CASE_CREATED'] },
      req as never,
      res as never,
    );
    expect(mockService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        tk: ['thaoTac~CASE_CREATED'],
        forExport: true,
      }),
      'audit-reader',
    );
  });

  it('actions() delegates to service.distinctActions', async () => {
    mockService.distinctActions.mockResolvedValue(['USER_CREATED', 'CASE_CREATED']);
    const result = await controller.actions(actorRequest);
    expect(result).toEqual(['USER_CREATED', 'CASE_CREATED']);
  });

  it('subjects() delegates to service.distinctSubjects', async () => {
    mockService.distinctSubjects.mockResolvedValue(['User', 'Case']);
    const result = await controller.subjects(actorRequest);
    expect(result).toEqual(['User', 'Case']);
  });
});
