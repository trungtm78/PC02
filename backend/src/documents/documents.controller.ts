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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { diskStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  ALLOWED_UPLOAD_MIMES,
  MAX_MEDIA_BYTES,
  validateUploadedDocument,
} from './document-upload-policy';

// Sprint 2 / S2.2 — Magic-byte MIME map cho file-type lib. file-type không
// detect được text/plain (no magic bytes), nên text/plain bypass magic-byte
// check (vẫn pass Content-Type whitelist + ext check).
const MAGIC_BYTE_BYPASS = new Set(['text/plain']);

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /api/documents — Danh sách tài liệu (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getList(@Query() query: QueryDocumentsDto, @Req() req: ScopedRequest) {
    return this.documentsService.getList(query, req.dataScope);
  }

  // GET /api/documents/:id — Chi tiết tài liệu
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Document' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.documentsService.getById(id, req.dataScope);
  }

  // POST /api/documents — Upload tài liệu mới
  // Sprint 1 / S1.3 — Throttle 10 upload/phút/user để chống storage abuse
  // (1000 file × 10MB = 10GB nếu không cap). Identity dùng JWT user qua
  // global throttler — không cần UserThrottlerGuard riêng.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          // SEC: crypto.randomBytes thay vì Math.random — defense-in-depth chống enumeration.
          const random = crypto.randomBytes(8).toString('hex');
          const ext = path.extname(file.originalname);
          cb(null, `${timestamp}-${random}${ext}`);
        },
      }),
      limits: {
        fileSize: MAX_MEDIA_BYTES,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Loại file không được hỗ trợ'), false);
        }
      },
    }),
  )
  @RequirePermissions({ action: 'write', subject: 'Document' })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('File upload là bắt buộc');
    }

    // Sprint 2 / S2.2 — Magic-byte validation: Content-Type header attacker-controlled.
    // file-type đọc magic bytes thật, kháng MIME spoofing attack.
    try {
      const detected = MAGIC_BYTE_BYPASS.has(file.mimetype)
        ? undefined
        : await (await import('file-type')).fileTypeFromFile(file.path);
      validateUploadedDocument(file, detected?.mime, dto.documentType);
    } catch (error) {
      fs.rmSync(file.path, { force: true });
      throw error;
    }

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
    await this.documentsService.getById(id, req.dataScope);
    // Sprint 2 / S2.1 — pass actor để audit log fire DOCUMENT_DOWNLOADED.
    const result = await this.documentsService.getDownloadInfo(id, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    const { filePath, originalName, mimeType } = result.data;

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(originalName)}"`,
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
