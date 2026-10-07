import {
  buildControllerModule,
  makeReq,
  mockUser,
} from '../test-utils/controller-test-helpers';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { CreateDocumentDto } from './dto/create-document.dto';
import { PassThrough, Readable } from 'node:stream';

jest.mock('fs', () => ({
  ...jest.requireActual<typeof fs>('fs'),
  rmSync: jest.fn(),
}));

const mockService = {
  getList: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getDownloadInfo: jest.fn(),
  openDownload: jest.fn(),
};
const request = (): ScopedRequest => makeReq() as unknown as ScopedRequest;
const user: AuthUser = mockUser;

describe('DocumentsController — delegation', () => {
  it('download transmits only service-verified bytes and preserves authenticated audit context', async () => {
    const bytes = Buffer.from('verified immutable snapshot'),
      response = Object.assign(new PassThrough(), { setHeader: jest.fn() }),
      chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve) =>
      response.once('finish', resolve),
    );
    mockService.openDownload.mockResolvedValue({
      data: {
        stream: Readable.from(bytes),
        originalName: 'reviewed public.pdf',
        mimeType: 'application/pdf',
      },
    });
    const req = request();
    await controller.download('doc', user, req, response as never);
    await finished;
    expect(Buffer.concat(chunks)).toEqual(bytes);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="reviewed%20public.pdf"',
    );
    expect(mockService.openDownload).toHaveBeenCalledWith(
      'doc',
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.dataScope,
    );
    expect(mockService.getDownloadInfo).not.toHaveBeenCalled();
  });
  let controller: DocumentsController;

  beforeEach(async () => {
    const module = await buildControllerModule(
      DocumentsController,
      DocumentsService,
      mockService,
    );
    controller = module.get(DocumentsController);
    jest.clearAllMocks();
  });

  it('getList() delegates to service.getList with query and dataScope', async () => {
    mockService.getList.mockResolvedValue({ data: [] });
    const req = request();
    await controller.getList({}, req, user);
    expect(mockService.getList).toHaveBeenCalledWith(
      {},
      req.dataScope,
      user.id,
    );
  });

  // Sprint 1 / S1.3 — File upload throttle: chống abuse upload spam.
  // Verify metadata key trùng pattern @nestjs/throttler dùng (THROTTLER:LIMIT + name).
  it('upload endpoint has @Throttle({ default: { ttl: 60000, limit: 10 } })', () => {
    const createMethod = Object.getOwnPropertyDescriptor(
      DocumentsController.prototype,
      'create',
    )?.value as object;
    const limit: unknown = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      createMethod,
    );
    const ttl: unknown = Reflect.getMetadata(
      'THROTTLER:TTLdefault',
      createMethod,
    );
    expect(limit).toBe(10);
    expect(ttl).toBe(60000);
  });

  it('getById() delegates to service.getById with id and dataScope', async () => {
    mockService.getById.mockResolvedValue({ data: {} });
    const req = request();
    await controller.getById('doc-1', req, user);
    expect(mockService.getById).toHaveBeenCalledWith(
      'doc-1',
      req.dataScope,
      user.id,
    );
  });

  it('update() delegates to service.update with id, dto, userId and audit info', async () => {
    mockService.update.mockResolvedValue({ data: {} });
    const req = request();
    await controller.update('doc-1', {}, user, req);
    expect(mockService.update).toHaveBeenCalledWith(
      'doc-1',
      {},
      user.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  it('delete() delegates to service.delete with id, userId, audit, dataScope', async () => {
    mockService.delete.mockResolvedValue({ success: true });
    const req = request();
    await controller.delete('doc-1', user, req);
    expect(mockService.delete).toHaveBeenCalledWith(
      'doc-1',
      user.id,
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
      req.dataScope,
    );
  });

  // Cycle 6 — Multer cleanup khi service.create throw (P1 R5).
  // File đã ghi đĩa qua multer trước khi service validate.
  // A service error after multer writes the file must still remove it.
  it('create() removes the multer file on service.create failure', async () => {
    const removeMock = fs.rmSync as jest.Mock;
    removeMock.mockClear();
    mockService.create.mockRejectedValue(
      new BadRequestException('Đơn thư không tồn tại'),
    );
    const req = request();
    const file = {
      filename: 'tmp-file.pdf',
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 100,
      path: '/uploads/documents/tmp-file.pdf',
    } as Express.Multer.File;

    await expect(
      controller.create(
        file,
        { title: 'Test' } as CreateDocumentDto,
        user,
        req,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(removeMock).toHaveBeenCalledWith('/uploads/documents/tmp-file.pdf', {
      force: true,
    });
  });

  it('removes a rejected file before calling the document service', async () => {
    const removeMock = fs.rmSync as jest.Mock;
    removeMock.mockClear();
    const req = request();
    const file = {
      filename: 'tmp-file.pdf',
      originalname: 'fake.pdf',
      mimetype: 'text/plain',
      size: 100,
      path: '/uploads/documents/tmp-file.pdf',
    } as Express.Multer.File;

    await expect(
      controller.create(file, { title: 'Fake' }, user, req),
    ).rejects.toThrow(BadRequestException);
    expect(mockService.create).not.toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith('/uploads/documents/tmp-file.pdf', {
      force: true,
    });
  });
});
