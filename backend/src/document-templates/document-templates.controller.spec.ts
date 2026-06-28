import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';

const mockSvc = {
  list: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 't1' }),
  getById: jest.fn().mockResolvedValue({ id: 't1' }),
  update: jest.fn().mockResolvedValue({ id: 't1' }),
  replaceFile: jest.fn().mockResolvedValue({ id: 't1' }),
  softDelete: jest.fn().mockResolvedValue(undefined),
  fieldCatalog: jest.fn().mockReturnValue([{ key: 'ghiTen', label: 'Họ tên người gửi', group: 'Người gửi' }]),
  previewVariables: jest.fn().mockReturnValue({ detected: ['ghiTen'], suggested: [] }),
  getFileForDownload: jest.fn().mockResolvedValue({ fileName: 'mẫu.docx', bytes: Buffer.from('docx') }),
};

describe('DocumentTemplatesController', () => {
  let ctrl: DocumentTemplatesController;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [DocumentTemplatesController],
      providers: [{ provide: DocumentTemplatesService, useValue: mockSvc }],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = mod.get(DocumentTemplatesController);
    jest.clearAllMocks();
  });

  it('create: truyền file + dto + userId xuống service', async () => {
    const file = { buffer: Buffer.from('x'), originalname: 'a.docx' } as any;
    await ctrl.create({ code: 'C' } as any, file, { id: 'u1' } as any);
    expect(mockSvc.create).toHaveBeenCalledWith({ code: 'C' }, file, 'u1');
  });

  it('create: thiếu file → BadRequest (throw đồng bộ trước khi gọi service)', () => {
    expect(() => ctrl.create({ code: 'C' } as any, undefined as any, { id: 'u1' } as any)).toThrow(
      BadRequestException,
    );
    expect(mockSvc.create).not.toHaveBeenCalled();
  });

  it('list: truyền query filter', async () => {
    await ctrl.list('VU_AN', undefined, 'active');
    expect(mockSvc.list).toHaveBeenCalledWith({ entityType: 'VU_AN', category: undefined, status: 'active' });
  });

  it('remove: gọi softDelete', async () => {
    await ctrl.remove('t1');
    expect(mockSvc.softDelete).toHaveBeenCalledWith('t1');
  });

  it('field-catalog: truyền entityType; thiếu → BadRequest', () => {
    ctrl.fieldCatalog('DON_THU');
    expect(mockSvc.fieldCatalog).toHaveBeenCalledWith('DON_THU');
    expect(() => ctrl.fieldCatalog('' as any)).toThrow(BadRequestException);
  });

  it('detect: thiếu file → BadRequest; thiếu entityType → BadRequest', () => {
    const file = { buffer: Buffer.from('x'), originalname: 'a.docx' } as any;
    expect(() => ctrl.detect({ entityType: 'DON_THU' }, undefined as any)).toThrow(BadRequestException);
    expect(() => ctrl.detect({}, file)).toThrow(BadRequestException);
    ctrl.detect({ entityType: 'DON_THU', delimStart: '[[', delimEnd: ']]' }, file);
    expect(mockSvc.previewVariables).toHaveBeenCalledWith(file, 'DON_THU', '[[', ']]');
  });

  it('download: set headers + trả StreamableFile', async () => {
    const res: any = { setHeader: jest.fn() };
    const out = await ctrl.download('t1', res);
    expect(mockSvc.getFileForDownload).toHaveBeenCalledWith('t1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('wordprocessingml'));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining("filename*=UTF-8''"),
    );
    expect(out).toBeDefined();
  });
});
