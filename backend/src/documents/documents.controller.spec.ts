import { buildControllerModule, makeReq, mockUser } from '../test-utils/controller-test-helpers';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  unlinkSync: jest.fn(),
}));

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getDownloadInfo: jest.fn(),
};

describe('DocumentsController — delegation', () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(DocumentsController, DocumentsService, mockService);
    controller = module.get(DocumentsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = makeReq();
    await controller.getList({} as any, req);
    expect(mockService.getList).toHaveBeenCalledWith({}, req.dataScope);
  });

  // Sprint 1 / S1.3 — File upload throttle: chống abuse upload spam.
  // Verify metadata key trùng pattern @nestjs/throttler dùng (THROTTLER:LIMIT + name).
  it('upload endpoint has @Throttle({ default: { ttl: 60000, limit: 10 } })', () => {
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      DocumentsController.prototype.create,
    );
    const ttl = Reflect.getMetadata(
      'THROTTLER:TTLdefault',
      DocumentsController.prototype.create,
    );
    expect(limit).toBe(10);
    expect(ttl).toBe(60000);
  });

  it('getById() delegates to service.getById with id and dataScope', async () => {
    mockService.getById.mockResolvedValue({ data: {} });
    const req = makeReq();
    await controller.getById('doc-1', req);
    expect(mockService.getById).toHaveBeenCalledWith('doc-1', req.dataScope);
  });

  it('update() delegates to service.update with id, dto, userId and audit info', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    const req = makeReq();
    await controller.update('doc-1', {} as any, mockUser, req);
    expect(mockService.update).toHaveBeenCalledWith(
      'doc-1',
      {},
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('delete() delegates to service.delete with id, userId, audit, dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = makeReq();
    await controller.delete('doc-1', mockUser, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'doc-1',
      mockUser.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  // Cycle 6 — Multer cleanup khi service.create throw (P1 R5).
  // File đã ghi đĩa qua multer trước khi service validate.
  // Validate fail → file rác trên disk. Controller phải fs.unlinkSync.
  it('create() unlinks the multer file on service.create failure', async () => {
    const unlinkSyncMock = fs.unlinkSync as jest.Mock;
    unlinkSyncMock.mockClear();
    mockService.create.mockRejectedValue(new BadRequestException('Đơn thư không tồn tại'));
    const req = makeReq();
    const file = {
      filename: 'tmp-file.pdf',
      originalname: 'test.pdf',
      mimetype: 'text/plain',  // dùng text/plain để bypass magic-byte check
      size: 100,
      path: '/uploads/documents/tmp-file.pdf',
    } as Express.Multer.File;

    await expect(
      controller.create(file, { title: 'Test' } as any, mockUser, req),
    ).rejects.toThrow(BadRequestException);

    expect(unlinkSyncMock).toHaveBeenCalledWith('/uploads/documents/tmp-file.pdf');
  });
});
