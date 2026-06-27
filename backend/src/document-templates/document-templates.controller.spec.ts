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
});
