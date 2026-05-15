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
// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
];

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
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
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
    if (!MAGIC_BYTE_BYPASS.has(file.mimetype)) {
      // ESM-only lib — dùng dynamic import vì backend là CommonJS
      const { fileTypeFromFile } = await import('file-type');
      const detected = await fileTypeFromFile(file.path);
      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        // Xoá file giả mạo khỏi disk để khỏi tốn storage + tránh leak path
        try { fs.unlinkSync(file.path); } catch { /* swallow — file có thể đã bị xoá */ }
        throw new BadRequestException(
          `Magic-byte không khớp Content-Type (declared: ${file.mimetype}, detected: ${detected?.mime ?? 'unknown'})`,
        );
      }
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

    return this.documentsService.create(documentDto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
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
    return this.documentsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
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
    return this.documentsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
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
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
