import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import * as fs from 'fs';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  assertUploadedDocument,
  documentUploadOptions,
} from './document-upload-policy';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /api/documents — Danh sách tài liệu (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getList(
    @Query() query: QueryDocumentsDto,
    @Req() req: ScopedRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getList(query, req.dataScope, user.id);
  }

  // GET /api/documents/:id — Chi tiết tài liệu
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getById(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.getById(id, req.dataScope, user.id);
  }

  // POST /api/documents — Upload tài liệu mới
  // Sprint 1 / S1.3 — Throttle 10 upload/phút/user để chống storage abuse
  // (1000 file × 10MB = 10GB nếu không cap). Identity dùng JWT user qua
  // global throttler — không cần UserThrottlerGuard riêng.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post()
  @UseInterceptors(FileInterceptor('file', documentUploadOptions()))
  @RequirePermissions({ action: 'write', subject: 'Document' })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    // Magic bytes, extension, type and size: the one check every upload route shares.
    await assertUploadedDocument(file, dto.documentType);

    // Populate file info from multer
    const documentDto: CreateDocumentDto = {
      ...dto,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filePath: file.path,
    };

    // Cycle 6 — Multer cleanup: file đã ghi đĩa trước khi service validate.
    // Nếu service throw (petitionId không tồn tại, out-of-scope, quota đầy...)
    // → xoá file rác. Không re-throw từ catch (rethrow gốc) để giữ stack trace.
    try {
      return await this.documentsService.create(
        documentDto,
        user.id,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        req.dataScope,
      );
    } catch (e) {
      fs.rmSync(file.path, { force: true });
      throw e;
    }
  }

  // PUT /api/documents/:id — Cập nhật thông tin tài liệu
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Document' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.documentsService.update(
      id,
      dto,
      user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.dataScope,
    );
  }

  // DELETE /api/documents/:id — Xóa tài liệu (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Document' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.documentsService.delete(
      id,
      user.id,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.dataScope,
    );
  }

  // GET /api/documents/:id/download — Tải xuống tài liệu
  @Get(':id/download')
  @RequirePermissions({ action: 'read', subject: 'Document' })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ) {
    // Sprint 2 / S2.1 — pass actor để audit log fire DOCUMENT_DOWNLOADED.
    const result = await this.documentsService.openDownload(
      id,
      {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.dataScope,
    );
    const { stream, originalName, mimeType } = result.data;

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(originalName)}"`,
    );

    stream.pipe(res);
  }
}
